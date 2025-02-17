import { foreignKeyField, resolverOnlyField, accessFilterSingle } from '../../utils/schemaUtils'
import SimpleSchema from 'simpl-schema'
import { addGraphQLSchema } from '../../vulcan-lib';
import { userCanReadField, userOwns } from '../../vulcan-users/permissions';
import { SharableDocument, userIsSharedOn } from '../users/helpers';

/**
 * This covers the type of originalContents for all editor types. 
 * (DraftJS uses object type. DraftJs is deprecated but there are still many documents that use it)
 */
export const ContentType = new SimpleSchema({
  type: String,
  data: SimpleSchema.oneOf(
    String,
    {
      type: Object,
      blackbox: true
    }
  )
})

SimpleSchema.extendOptions([ 'inputType' ]);

// Graphql doesn't allow union types that include scalars, which is necessary
// to accurately represent the data field the ContentType simple schema.

// defining a custom scalar seems to allow it to pass through any data type,
// but this doesn't seem much more permissive than ContentType was originally
addGraphQLSchema(`
  scalar ContentTypeData
`)

addGraphQLSchema(`
  type ContentType {
    type: String
    data: ContentTypeData
  }
`)

const isSharable = (document: any) : document is SharableDocument => {
  return "coauthorStatuses" in document || "shareWithUsers" in document || "sharingSettings" in document
}

export const getOriginalContents = (currentUser: DbUser|null, document: DbObject, originalContents: EditableFieldContents["originalContents"]) => {
  const canViewOriginalContents = (user: DbUser|null, doc: DbObject) => isSharable(doc) ? userIsSharedOn(user, doc) : true

  const returnOriginalContents = userCanReadField(currentUser, {viewableBy: [userOwns, canViewOriginalContents, 'admins', 'sunshineRegiment']}, document)
  return returnOriginalContents ? originalContents : null
}

const schema: SchemaType<DbRevision> = {
  documentId: {
    type: String,
    viewableBy: ['guests'],
  },
  collectionName: {
    type: String,
    viewableBy: ['guests'],
    typescriptType: "CollectionNameString",
  },
  fieldName: {
    type: String,
    viewableBy: ['guests'],
  },
  editedAt: {
    type: Date,
    optional: true,
    viewableBy: ['guests'],
  },
  
  // autosaveTimeoutStart: If this revision was created by rate-limited
  // autosaving, this is the timestamp that the rate limit is computed relative
  // to. This is separate from editedAt, which is when this revision was last
  // rewritten. This is so that if the revision is repeatedly updated in place,
  // chaining together edits can't produce an interval longer than the
  // intended one.
  //
  // Optional, only present on revisions that have been autosaved in-place at
  // least once.
  //
  // See also: saveOrUpdateDocumentRevision in ckEditorWebhook.ts
  autosaveTimeoutStart: {
    type: Date,
    optional: true,
  },
  
  updateType: {
    viewableBy: ['guests'],
    editableBy: ['members'],
    type: String,
    allowedValues: ['initial', 'patch', 'minor', 'major'],
    optional: true
  },
  version: {
    type: String,
    optional: true,
    viewableBy: ['guests']
  },
  commitMessage: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
    editableBy: ['members']
  },
  userId: {
    ...foreignKeyField({
      idFieldName: "userId",
      resolverName: "user",
      collectionName: "Users",
      type: "User",
      nullable: true
    }),
    viewableBy: ['guests'],
    optional: true,
  },
  
  // Whether this revision is a draft (ie unpublished). This is here so that
  // after a post is published, we have a sensible way for users to save edits
  // that they don't want to publish just yet. Note that this is redundant with
  // posts' draft field, and does *not* have to be in sync; the latest revision
  // can be a draft even though the document is published (ie, there's a saved
  // but unpublished edit), and the latest revision can be not-a-draft even
  // though the document itself is marked as a draft (eg, if the post was moved
  // back to drafts after it was published).
  //
  // This field will not normally be edited after insertion.
  //
  // The draftiness of a revision used to be implicit in the version number,
  // with 0.x meaning draft and 1.x meaning non-draft, except for tags/wiki
  // where 0.x means imported from the old wiki instead.
  draft: {
    type: Boolean,
    hidden: true,
    optional: true,
    viewableBy: ['guests'],
  },
  originalContents: {
    type: ContentType,
    viewableBy: ['guests'],
    resolveAs: {
      type: 'ContentType',
      resolver: async (document: DbRevision, args: void, context: ResolverContext): Promise<DbRevision["originalContents"]|null> => {
        // Original contents sometimes contains private data (ckEditor suggestions 
        // via Track Changes plugin). In those cases the html field strips out the 
        // suggestion. Original contents is only visible to people who are invited 
        // to collaborative editing. (This is only relevant for posts, but supporting
        // it means we need originalContents to default to unviewable)
        if (document.collectionName === "Posts") {
          const post = await context.loaders["Posts"].load(document.documentId)
          return getOriginalContents(context.currentUser, post, document.originalContents)
        }
        return document.originalContents
      }
    }
  },
  html: {
    type: String,
    optional: true,
    viewableBy: ['guests'],
  },
  markdown: {
    type: String,
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  draftJS: {
    type: Object,
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  ckEditorMarkup: {
    type: String,
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  wordCount: {
    type: Number,
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  htmlHighlight: {
    type: String, 
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  htmlHighlightStartingAtHash: {
    type: String, 
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  plaintextDescription: {
    type: String, 
    viewableBy: ['guests'],
    // resolveAs defined in resolvers.js
  },
  plaintextMainText: {
    type: String,
    viewableBy: ['guests']
    // resolveAs defined in resolvers.js
  },
  changeMetrics: {
    type: Object,
    blackbox: true,
    viewableBy: ['guests']
  },
  
  tag: resolverOnlyField({
    type: "Tag",
    graphQLtype: "Tag",
    viewableBy: ['guests'],
    resolver: async (revision: DbRevision, args: void, context: ResolverContext) => {
      const {currentUser, Tags} = context;
      if (revision.collectionName !== "Tags")
        return null;
      const tag = await context.loaders.Tags.load(revision.documentId);
      return await accessFilterSingle(currentUser, Tags, tag, context);
    }
  }),
  post: resolverOnlyField({
    type: "Post",
    graphQLtype: "Post",
    viewableBy: ['guests'],
    resolver: async (revision: DbRevision, args: void, context: ResolverContext) => {
      const {currentUser, Posts} = context;
      if (revision.collectionName !== "Posts")
        return null;
      const post = await context.loaders.Posts.load(revision.documentId);
      return await accessFilterSingle(currentUser, Posts, post, context);
    }
  }),
};

export default schema;
