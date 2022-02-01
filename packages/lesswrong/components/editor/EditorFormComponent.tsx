import React, { useState, useCallback, useRef, useEffect } from 'react';
import { registerComponent, Components } from '../../lib/vulcan-lib';
import { editableCollectionsFieldOptions } from '../../lib/editor/make_editable';
import { getLSHandlers, getLSKeyPrefix } from './localStorageHandlers'
import { userHasCkCollaboration, userCanCreateCommitMessages } from '../../lib/betas';
import { useCurrentUser } from '../common/withUser';
import { Editor, EditorChangeEvent, getUserDefaultEditor, getInitialEditorContents, getBlankEditorContents, EditorContents, isBlank, serializeEditorContents, EditorTypeString, styles } from './Editor';
import withErrorBoundary from '../common/withErrorBoundary';
import PropTypes from 'prop-types';
import * as _ from 'underscore';

const autosaveInterval = 3000; //milliseconds

export function isCollaborative(post, fieldName: string): boolean {
  if (!post) return false;
  if (!post._id) return false;
  if (fieldName !== "contents") return false;
  if (post?.shareWithUsers) return true;
  if (post?.sharingSettings?.anyoneWithLinkCan && post.sharingSettings.anyoneWithLinkCan !== "none")
    return true;
  return false;
}

export const EditorFormComponent = ({form, formType, formProps, document, name, fieldName, value, hintText, placeholder, label, commentStyles, classes}: {
  form: any,
  formType: "edit"|"new",
  formProps: any,
  document: any,
  name: any,
  fieldName: any,
  value: any,
  hintText: string,
  placeholder: string,
  label: string,
  commentStyles: boolean,
  classes: ClassesType,
}, context: any) => {
  const { commentEditor, collectionName, hideControls } = (form || {});
  const { editorHintText, maxHeight } = (formProps || {});
  const { updateCurrentValues } = context;
  const currentUser = useCurrentUser();
  const editorRef = useRef<Editor|null>(null);
  const hasUnsavedDataRef = useRef({hasUnsavedData: false});
  const isCollabEditor = isCollaborative(document, fieldName);
  
  const getLocalStorageHandlers = useCallback((editorType: EditorTypeString) => {
    const getLocalStorageId = editableCollectionsFieldOptions[collectionName][fieldName].getLocalStorageId;
    return getLSHandlers(getLocalStorageId, document, name,
      getLSKeyPrefix(editorType)
    );
  }, [collectionName, document, name, fieldName]);
  
  const [contents,setContents] = useState(() => getInitialEditorContents(
    value, document, fieldName, currentUser
  ));
  const [initialEditorType] = useState(contents.type);
  
  const defaultEditorType = getUserDefaultEditor(currentUser);
  const currentEditorType = contents?.type || defaultEditorType;
  const showEditorWarning = formType !== "new" && initialEditorType !== defaultEditorType && currentEditorType !== defaultEditorType;
  
  const saveBackup = useCallback((newContents: EditorContents) => {
    if (isBlank(newContents)) {
      getLocalStorageHandlers(currentEditorType).reset();
      hasUnsavedDataRef.current.hasUnsavedData = false;
    } else {
      const serialized = serializeEditorContents(newContents);
      const success = getLocalStorageHandlers(newContents.type).set(serialized);
  
      if (success) {
        hasUnsavedDataRef.current.hasUnsavedData = false;
      }
    }
  }, [getLocalStorageHandlers, currentEditorType]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledSaveBackup = useCallback(
    _.throttle(saveBackup, autosaveInterval, {leading: false}),
    [saveBackup, autosaveInterval]
  );
  
  const wrappedSetContents = useCallback((change: EditorChangeEvent) => {
    const {contents,autosave} = change;
    setContents(contents);
    
    // Only save to localStorage if not using collaborative editing, since with
    // collaborative editing stuff is getting constantly sent through a
    // websocket and saved taht way.
    if (!isCollabEditor) {
      if (!isBlank(contents)) {
        hasUnsavedDataRef.current.hasUnsavedData = true;
      }
    }
    
    // Hack: Fill in ${fieldName}_type with the editor type, to enable other
    // form components (in particular PostSharingSettings) to check whether we're
    // using CkEditor vs draftjs vs etc. (We transfer the actual contents from
    // the editor to vulcan-forms only as a final step upon form submit, because
    // this is a serialization of the whole document which can be too slow to do
    // on every keystroke).
    updateCurrentValues({[`${fieldName}_type`]: change.contents?.type});
    
    if (autosave) {
      throttledSaveBackup(contents);
    }
  }, [throttledSaveBackup, updateCurrentValues, fieldName, isCollabEditor]);
  
  useEffect(() => {
    const unloadEventListener = (ev) => {
      if (hasUnsavedDataRef?.current?.hasUnsavedData) {
        ev.preventDefault();
        ev.returnValue = 'Are you sure you want to close?';
        return ev.returnValue
      }
    };
    
    window.addEventListener("beforeunload", unloadEventListener);
    return () => {
      window.removeEventListener("beforeunload", unloadEventListener);
    };
  }, [fieldName, hasUnsavedDataRef]);
  
  const onRestoreLocalStorage = useCallback((newState: EditorContents) => {
    wrappedSetContents({contents: newState, autosave: false});
    if (editorRef.current)
      editorRef.current.focusOnEditor();
  }, [editorRef, wrappedSetContents]);
  
  useEffect(() => {
    if (editorRef.current) {
      const cleanupSubmitForm = context.addToSubmitForm((submission) => {
        if (editorRef.current)
          return {
            ...submission,
            [fieldName]: editorRef.current.submitData(submission)
          };
        else
          return submission;
      });
      const cleanupSuccessForm = context.addToSuccessForm((result) => {
        getLocalStorageHandlers(currentEditorType).reset();
        if (editorRef.current) {
          wrappedSetContents({
            contents: getBlankEditorContents(initialEditorType),
            autosave: false,
          });
        }
        return result;
      });
      return () => {
        cleanupSubmitForm();
        cleanupSuccessForm();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!editorRef.current, fieldName, initialEditorType, context.addToSuccessForm, context.addToSubmitForm]);
  
  const fieldHasCommitMessages = editableCollectionsFieldOptions[collectionName][fieldName].revisionsHaveCommitMessages;
  const hasCommitMessages = fieldHasCommitMessages
    && currentUser && userCanCreateCommitMessages(currentUser)
    && (collectionName!=="Tags" || formType==="edit");
  
  const actualPlaceholder = (editorHintText || hintText || placeholder || label);
  
  if (!document) return null;

  return <div>
    {showEditorWarning &&
      <Components.LastEditedInWarning
        initialType={initialEditorType}
        currentType={contents.type}
        defaultType={defaultEditorType}
        value={contents} setValue={wrappedSetContents}
      />
    }
    {!isCollabEditor &&<Components.LocalStorageCheck
      getLocalStorageHandlers={getLocalStorageHandlers}
      onRestore={onRestoreLocalStorage}
    />}
    <Components.Editor
      ref={editorRef}
      _classes={classes}
      currentUser={currentUser}
      formType={formType}
      documentId={document?._id}
      collectionName={collectionName}
      fieldName={fieldName}
      initialEditorType={initialEditorType}
      isCollaborative={isCollabEditor}
      accessLevel={document?.myEditorAccess}
      value={contents}
      onChange={wrappedSetContents}
      placeholder={actualPlaceholder}
      commentStyles={commentStyles}
      answerStyles={document?.answer}
      questionStyles={document?.question}
      commentEditor={commentEditor}
      hideControls={hideControls}
      maxHeight={maxHeight}
      hasCommitMessages={hasCommitMessages}
    />
    {!hideControls && <Components.EditorTypeSelect value={contents} setValue={wrappedSetContents} isCollaborative={isCollaborative(document, fieldName)}/>}
    {!hideControls && collectionName==="Posts" && fieldName==="contents" &&
      <Components.PostVersionHistoryButton
        postId={document?._id}
      />
    }
  </div>
}

export const EditorFormComponentComponent = registerComponent('EditorFormComponent', EditorFormComponent, {
  hocs: [withErrorBoundary], styles
});

(EditorFormComponent as any).contextTypes = {
  addToSubmitForm: PropTypes.func,
  addToSuccessForm: PropTypes.func,
  updateCurrentValues: PropTypes.func,
};

declare global {
  interface ComponentTypes {
    EditorFormComponent: typeof EditorFormComponentComponent
  }
}
