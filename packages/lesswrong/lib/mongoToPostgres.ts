import * as _ from 'underscore';

// For unit tests. We need a schema to determine field types in some cases, but
// unit tests don't involve real collections. This is a more-minimal type that
// provides just the parts of the schema that the query translation needs.
export type FakeCollectionSchema = Record<string,{type:any}>


export const mongoSelectorToSql = <T extends DbObject>(schema: SchemaType<T>|FakeCollectionSchema, selector: MongoSelector<T>, argOffset?: number) => {
  let selectorFragments: string[] = [];
  let args: any[] = [];
  
  // Split selector fields into two groups: simple selectors (which will be handled by postgres' @>
  // operator) and complex selectors (which require some sort of special case handling).
  let simpleSelectorKeys: string[] = [];
  let complexSelectorKeys: string[] = [];
  for (let key of Object.keys(selector)) {
    if (isSimpleSelector(selector, key)) {
      simpleSelectorKeys.push(key);
    } else {
      complexSelectorKeys.push(key);
    }
  }
  
  if (simpleSelectorKeys.length > 0) {
    const {sql: atGreaterWhereClause, args: atGreaterArgs} = mongoSelectorToAtGreater(selector, simpleSelectorKeys, (argOffset||1)+args.length);
    selectorFragments.push(atGreaterWhereClause);
    args = [...args, ...atGreaterArgs];
  }
  
  for (let selectorKey of complexSelectorKeys) {
    const {sql,arg} = mongoSelectorFieldToSql(schema, selectorKey, selector[selectorKey], (argOffset||1)+args.length);
    if (sql && sql.length > 0) {
      selectorFragments.push(sql);
      args = [...args, ...arg];
    }
  }
  
  if (selectorFragments.length===0) {
    return { sql: "true", arg: [] };
  }
  
  return {
    sql: selectorFragments.join(" and "),
    arg: args,
  };
}

const mongoSelectorToAtGreater = (selector: any, keys: string[], argOffset: number) => {
  const queryObject = {};
  for (let key of keys) {
    queryObject[key] = selector[key];
  }
  return {
    sql: `json @> $${argOffset}`,
    args: [JSON.stringify(queryObject)],
  };
}

const isSimpleSelector = (selector: any, key: string): boolean => {
  if (selector[key] === undefined || selector[key] === null || key==="_id")
    return false;
  if (key.indexOf(".") >= 0)
    return false;
  if (typeof selector[key] === 'object')
    return false;
  return true;
}

export const mongoModifierToSql = <T extends DbObject>(collection: CollectionBase<T>, modifier: MongoModifier<T>, argOffset?: number) => {
  let sql = "json";
  let args: any[] = [];
  
  if (modifier.$set && Object.keys(modifier.$set).length > 0) {
    // TODO: This doesn't handle dotted paths correctly
    sql = `${sql} || jsonb_build_object(${Object.keys(modifier.$set).map((k,i)=>`'${k}',$${(argOffset||1)+args.length+i}`).join(',')})`;
    args = [...args, ...Object.keys(modifier.$set).map(k => modifier.$set[k])];
  }
  if (modifier.$unset && Object.keys(modifier.$unset).length > 0) {
    // TODO: This doesn't handle dotted paths correctly
    sql = `((${sql}) ${Object.keys(modifier.$unset).map(k => `- '${k}'`).join(' ')})`;
  }
  if (modifier.$inc && Object.keys(modifier.$inc).length > 0) {
    // TODO: This doesn't handle dotted paths correctly
    sql = `${sql} || jsonb_build_object(${Object.keys(modifier.$inc).map((k,i)=>`'${k}',${mongoFieldToSqlWithSchema(k,collection)} + $${(argOffset||1)+args.length+i}`).join(",")})`;
    args = [...args, ...Object.keys(modifier.$inc).map(k => modifier.$inc[k])];
  }
  if (modifier.$addToSet) {
    for (let key of Object.keys(modifier.$addToSet)) {
      let path = `'{${key.split('.').join(',')},-1}'`;
      sql = `jsonb_insert(${sql}, ${path}, $${(argOffset||1)+args.length}, true)`
      args = [...args, modifier.$addToSet[key]];
    }
  }
  for (let key of Object.keys(modifier)) {
    if (key!=="$set" && key!=="$unset" && key!=="$inc" && key!=="$addToSet")
      throw new Error(`Unrecognized mongo modifier: ${key}`);
  }
  
  return {sql: `json=${sql}`, arg: args};
}


export const mongoFindOptionsToSql = <T extends DbObject>(collection: CollectionBase<T>, options?: MongoFindOptions<T>) => {
  let queryTextFragments: string[] = [];
  let args: any[] = [];
  
  if (options) {
    if (options.sort) {
      const {sql: sortFragment, arg: sortArgs} = mongoSortToOrderBy(collection, options.sort, args.length+1);
      queryTextFragments.push(sortFragment);
      args = [...args, ...sortArgs];
    }
    if (options.limit) {
      queryTextFragments.push('limit '+options.limit);
    }
  }
  
  return {
    sql: queryTextFragments.join(" "),
    arg: args,
  }
}

export const mongoSelectorFieldToSql = <T extends DbObject>(schema: SchemaType<T>|FakeCollectionSchema, fieldName: string, value: any, argOffset: number): {sql: string|null, arg: any[]} => {
  if (typeof fieldName !== 'string')
    throw new Error("fieldName is not a string: was "+(typeof fieldName));
  if (typeof argOffset !== 'number')
    throw new Error("argOffset is not a number: was "+(typeof argOffset));
  
  if (fieldName==="_id") {
    if (typeof value==="string") {
      return {
        sql: `id=$${argOffset}`,
        arg: [value],
      };
    } else if (typeof value==="object" && value.$in) {
      if (!(value.$in instanceof Array)) {
        throw new Error("Argument to $in must be an array");
      } else if (!value.$in.length) {
        return {
          sql: "false",
          arg: [],
        };
      } else {
        return {
          sql: `id IN (${_.range(value.$in.length).map(i => `$${i+argOffset}`)})`,
          arg: value.$in,
        };
      }
    } else {
      throw new Error(`Don't know how to handle selector for ${fieldName}`); // TODO
    }
  } else if (fieldName==="$or") {
    if (!value || !value.length) {
      return {
        sql: null,
        arg: [],
      }
    }
    const subselectors: any[] = [];
    for (let s of value) {
      const subselector = mongoSelectorToSql(schema, s, argOffset);
      subselectors.push(subselector);
      argOffset += subselector.arg.length;
    }
    return {
      sql: `(${subselectors.map(s=>s.sql).join(" or ")})`,
      arg: _.flatten(subselectors.map(s=>s.arg, true)),
    };
  } else if (fieldName==="$and") {
    if (!value || !value.length) {
      return {
        sql: null,
        arg: [],
      }
    }
    const subselectors: any[] = [];
    for (let s of value) {
      const subselector = mongoSelectorToSql(schema, s, argOffset);
      subselectors.push(subselector);
      argOffset += subselector.arg.length;
    }
    return {
      sql: `(${subselectors.map(s=>s.sql).join(" and ")})`,
      arg: _.flatten(subselectors.map(s=>s.arg, true)),
    };
  } else if (fieldName==="$not") {
    throw new Error(`Don't know how to handle selector for ${fieldName}: $not`); // TODO
  } else if (value === null || value === undefined) {
    return {
      sql: `(jsonb_typeof(json->'${fieldName}') IS NULL OR jsonb_typeof(json->'${fieldName}')='null')`,
      arg: [],
    };
  } else if (typeof value==='object') {
    for (let op of Object.keys(value)) {
      if (op==="$in") {
        if (!(value.$in instanceof Array)) {
          throw new Error("Argument to $in must be an array");
        } else if (value.$in.length === 0) {
          // Special case for $in:[] (never matches anything)
          return {
            sql: "false",
            arg: [],
          }
        } else if (_.all(Object.keys(value.$in), k=>(typeof k == "string"))) {
          // Special case: all strings (used in query-by-ID)
          return {
            sql: `${mongoFieldToSql(fieldName, schema, value.$in[0])} IN (${_.range(value.$in.length).map(i => `$${i+argOffset}`)})`,
            arg: value.$in,
          }
        } else {
          // TODO
          throw new Error("Don't know how to handle $in with mixed types");
        }
      } else if (op==="$gt") {
        return mongoInequalityToSql(fieldName, value.$gt, ">");
      } else if (op==="$gte") {
        return mongoInequalityToSql(fieldName, value.$gte, ">=");
      } else if (op==="$lt") {
        return mongoInequalityToSql(fieldName, value.$lt, "<");
      } else if (op==="$lte") {
        return mongoInequalityToSql(fieldName, value.$lte, "<=");
      } else if (op==="$exists") {
        if (value.$exists) {
          return {
            sql: `json ? '${fieldName}'`,
            arg: [],
          }
        } else {
          return {
            sql: `not (json ? '${fieldName}')`,
            arg: [],
          }
        }
      } else if (op==="$ne") {
        if (value.$ne === null) {
          return {
            sql: `json ? '${fieldName}' and json->>'${fieldName}'!='null'`,
            arg: [],
          }
        } else {
          return {
            sql: `${mongoFieldToSql(fieldName, schema, value.$ne)} != $${argOffset}`,
            arg: [value.$ne],
          }
        }
      } else {
        throw new Error(`Don't know how to handle selector for ${fieldName} op ${op}`); // TODO
      }
    }
    throw new Error(`Don't know how to handle selector for ${fieldName}: unrecognized object`); // TODO
  } else if (typeof value=='boolean') {
    return {
      sql: `(json->'${fieldName}')::bool=${value}`,
      arg: [],
    }
  } else {
    return {
      sql: `jsonb_path_match(json, '$.${fieldName} == ${JSON.stringify(value)}')`,
      arg: [],
    };
  }
}

const mongoInequalityToSql = (fieldName: string, value: any, op: string) => {
  return {
    sql: `jsonb_path_match(json, '$.${fieldName} ${op} ${JSON.stringify(value)}')`,
    arg: [],
  };
}

const mongoFieldToSql = <T extends DbObject>(fieldName: string, schema: SchemaType<T>|FakeCollectionSchema, inferTypeFromValue: any) => {
  let jsonObject = "json";
  
  const schemaField = schema && schema[fieldName];
  if (schemaField) {
    const fieldType = schemaField.type;
    
    if (fieldType === Number)
      return `${jsonObject}->'${fieldName}'`
    else
      return `${jsonObject}->>'${fieldName}'`
  } else {
    if (typeof inferTypeFromValue === 'string') {
      return `(${jsonObject}->>'${fieldName}')`;
    } else if (typeof inferTypeFromValue === 'number') {
      return `(${jsonObject}->'${fieldName}')::int`;
    } else if (typeof inferTypeFromValue==='boolean') {
      return `(${jsonObject}->'${fieldName}')::boolean`;
    } else if (inferTypeFromValue instanceof Date) {
      return `(${jsonObject}->>'${fieldName}')`;
    } else {
      // TODO
      throw new Error(`Don't know how to handle selector for ${fieldName}: cannot infer type from ${inferTypeFromValue}`);
    }
  }
}

const mongoFieldToSqlWithSchema = <T extends DbObject>(fieldName: string, collection: CollectionBase<T>) => {
  const schemaField = collection._schemaFields[fieldName];
  if (!schemaField) throw new Error(`Field not in schema: ${collection.collectionName}.${fieldName}`);
  const fieldType = schemaField.type;
  
  if (fieldType === Number)
    return `json->'${fieldName}'`
  else
    return `json->>'${fieldName}'`
}

const mongoSortToOrderBy = <T extends DbObject>(collection: CollectionBase<T>, mongoSort: MongoSort<T>, argOffset: number): {sql: string, arg: string[]} => {
  const fragments: string[] = [];
  for (let sortKey of Object.keys(mongoSort)) {
    if (sortKey==='_id') {
      fragments.push(`id ${mongoSortDirectionToSql(mongoSort[sortKey]!)}`);
    } else {
      fragments.push(`${mongoFieldToSqlWithSchema(sortKey, collection)} ${mongoSortDirectionToSql(mongoSort[sortKey])}`);
    }
  }
  
  return {
    sql: `order by ${fragments.join(", ")}`,
    arg: [],
  }
}

const mongoSortDirectionToSql = (sortDirection: number): string => {
  if (sortDirection===1) {
    return "ASC";
  } else if (sortDirection===-1) {
    return "DESC";
  } else {
    throw new Error(`Invalid sort direction: ${sortDirection}`);
  }
}
