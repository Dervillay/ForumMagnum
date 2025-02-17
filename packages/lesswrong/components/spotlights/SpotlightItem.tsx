import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import EditIcon from '@material-ui/icons/Edit';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import classNames from 'classnames';
import React, { useState } from 'react';
import Spotlights from '../../lib/collections/spotlights/collection';
import { Link } from '../../lib/reactRouterWrapper';
import { Components, getFragment, registerComponent } from '../../lib/vulcan-lib';
import { userCanDo } from '../../lib/vulcan-users';
import { postBodyStyles } from '../../themes/stylePiping';
import { useCurrentUser } from '../common/withUser';


export const descriptionStyles = theme => ({
  ...postBodyStyles(theme),
  ...theme.typography.body2,
  textShadow: `0 0 16px ${theme.palette.grey[0]}, 0 0 16px ${theme.palette.grey[0]}, 0 0 16px ${theme.palette.grey[0]}, 0 0 16px ${theme.palette.grey[0]}, 0 0 16px ${theme.palette.grey[0]}, 0 0 16px ${theme.palette.grey[0]}, `
})

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    marginBottom: 12,
    boxShadow: theme.palette.boxShadow.default,
  },
  spotlightItem: {
    position: "relative",
    background: theme.palette.panelBackground.default,
    '&:hover': {
      boxShadow: theme.palette.boxShadow.sequencesGridItemHover,
    },
    '&:hover $editButtonIcon': {
      opacity: .2
    },
    '&:hover $closeButton': {
      color: theme.palette.grey[100],
    }
  },
  closeButtonWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  closeButton: {
    padding: '.5em',
    minHeight: '.75em',
    minWidth: '.75em',
    color: theme.palette.grey[300],
    zIndex: theme.zIndexes.spotlightItemCloseButton,
  },
  content: {
    padding: 16,
    paddingRight: 35,
    paddingBottom: 0,
    display: "flex",
    // overflow: "hidden",
    flexDirection: "column",
    justifyContent: "space-between",
    marginRight: 150,
    position: "relative",
    zIndex: theme.zIndexes.spotlightItem,
    [theme.breakpoints.up('sm')]: {
      minHeight: 100
    },
    [theme.breakpoints.down('xs')]: {
      marginRight: 100
    },
    '& br': {
      [theme.breakpoints.down('sm')]: {
        display: "none"
      }
    }
  },
  postPadding: {
    paddingBottom: 12
  },
  description: {
    marginTop: 8,
    ...descriptionStyles(theme),
    position: "relative",
    lineHeight: '1.65rem',
    [theme.breakpoints.down('xs')]: {
      display: "none"
    }
  },
  title: {
    ...theme.typography.headerStyle,
    fontSize: 20,
    fontVariant: "small-caps",
    lineHeight: "1.2em",
    display: "flex",
    alignItems: "center"
  },
  subtitle: {
    ...theme.typography.postStyle,
    fontSize: 15,
    color: theme.palette.grey[700],
    marginTop: -1,
    fontStyle: "italic"
  },
  image: {
    '& img': {
      position: "absolute",
      top: 0,
      right: 0,
      height: "100%",  
    }
  },
  editAllButton: {
    [theme.breakpoints.up('md')]: {
      position: "absolute",
      top: 6,
      right: -28,
    },
    [theme.breakpoints.down('sm')]: {
      position: "absolute",
      top: 4,
      right: 8
    },
  },
  editAllButtonIcon: {
    width: 20
  },
  editButtonIcon: {
    width: 18,
    opacity: 0,
    cursor: "pointer",
    zIndex: theme.zIndexes.spotlightItemCloseButton,
    [theme.breakpoints.down('sm')]: {
      color: theme.palette.background.pageActiveAreaBackground,
      width: 16,
      opacity:.2
    },
    '&:hover': {
      opacity: .5
    }
  },
  editDescriptionButton: {
    marginLeft: 8
  },
  editDescription: {
    '& .form-input': {
      margin: 0
    },
    '& .EditorFormComponent-commentEditorHeight': {
      minHeight: "unset"
    },
    '& .EditorFormComponent-commentEditorHeight .ck.ck-content': {
      minHeight: "unset"
    },
    '& .ck.ck-content.ck-editor__editable': {
      ...theme.typography.body2,
    },
    '& .form-submit button': {
      position: "absolute",
      bottom: 0,
      right: 0,
      background: theme.palette.background.translucentBackground,
      marginLeft: 12,
      opacity: .5,
      '&:hover': {
        opacity: 1
      }
    }
  },
  form: {
    borderTop: theme.palette.border.faint,
    background: theme.palette.background.translucentBackground,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8
  }
});

const getUrlFromDocument = (document: SpotlightDisplay_document, documentType: SpotlightDocumentType) => {
  switch (documentType) {
    case "Sequence":
      return `/s/${document._id}`;
    case "Post":
      return `/posts/${document._id}/${document.slug}`
  }
}


export const SpotlightItem = ({classes, spotlight, showAdminInfo, hideBanner, refetchAllSpotlights}: {
  spotlight: SpotlightDisplay,
  showAdminInfo?: boolean,
  hideBanner?: () => void,
  classes: ClassesType,
  // This is so that if a spotlight's position is updated (in SpotlightsPage), we refetch all of them to display them with their updated positions and in the correct order
  refetchAllSpotlights?: () => void,
}) => {
  const { MetaInfo, FormatDate, AnalyticsTracker, ContentItemBody, CloudinaryImage, LWTooltip, WrappedSmartForm, SpotlightEditorStyles, SpotlightStartOrContinueReading } = Components
  
  const currentUser = useCurrentUser()

  const [edit, setEdit] = useState<boolean>(false)
  const [editDescription, setEditDescription] = useState<boolean>(false)

  const url = getUrlFromDocument(spotlight.document, spotlight.documentType)


  const duration = spotlight.duration

  const onUpdate = () => {
    setEdit(false);
    refetchAllSpotlights?.();
  };

  return <AnalyticsTracker eventType="spotlightItem" captureOnMount captureOnClick={false}>
    <div className={classes.root}>
      <div className={classes.spotlightItem}>
        <div className={classNames(classes.content, {[classes.postPadding]: spotlight.documentType === "Post"})}>
          <div className={classes.title}>
            <Link to={url}>
              {spotlight.customTitle ?? spotlight.document.title}
            </Link>
            <span className={classes.editDescriptionButton}>
              {userCanDo(currentUser, 'spotlights.edit.all') && <LWTooltip title="Edit Spotlight">
                <EditIcon className={classes.editButtonIcon} onClick={() => setEditDescription(!editDescription)}/>
              </LWTooltip>}
            </span>
          </div>
          {spotlight.customSubtitle && <div className={classes.subtitle}>
            {spotlight.customSubtitle}
          </div>}
          <div className={classes.description}>
            {editDescription ? 
              <div className={classes.editDescription}>
                <WrappedSmartForm
                  collection={Spotlights}
                  fields={['description']}
                  documentId={spotlight._id}
                  mutationFragment={getFragment('SpotlightEditQueryFragment')}
                  queryFragment={getFragment('SpotlightEditQueryFragment')}
                  successCallback={() => setEditDescription(false)}
                />
              </div>
              :
              <ContentItemBody
                dangerouslySetInnerHTML={{__html: spotlight.description?.html ?? ''}}
                description={`${spotlight.documentType} ${spotlight.document._id}`}
              />
            }
          </div>
        </div>
        {spotlight.spotlightImageId && <div className={classes.image}>
          <CloudinaryImage publicId={spotlight.spotlightImageId} />
        </div>}
        <SpotlightStartOrContinueReading spotlight={spotlight} />
        {hideBanner && <div className={classes.closeButtonWrapper}>
          <LWTooltip title="Hide this item for the next month" placement="right">
            <Button className={classes.closeButton} onClick={hideBanner}>
              <CloseIcon className={classes.closeIcon} />
            </Button>
          </LWTooltip>
        </div>}
        <div className={classes.editAllButton}>
          {userCanDo(currentUser, 'spotlights.edit.all') && <LWTooltip title="Edit Spotlight">
            <MoreVertIcon className={classNames(classes.editButtonIcon, classes.editAllButtonIcon)} onClick={() => setEdit(!edit)}/>
          </LWTooltip>}
        </div>
      </div>
      {showAdminInfo && <div className={classes.form}>
        {edit ? <SpotlightEditorStyles>
           <WrappedSmartForm
              collection={Spotlights}
              documentId={spotlight._id}
              mutationFragment={getFragment('SpotlightEditQueryFragment')}
              queryFragment={getFragment('SpotlightEditQueryFragment')}
              successCallback={onUpdate}
            /> 
          </SpotlightEditorStyles>
           :
          <div>
            {spotlight.draft && <MetaInfo>[Draft]</MetaInfo>}
            <MetaInfo>{spotlight.position}</MetaInfo>
            <MetaInfo><FormatDate date={spotlight.lastPromotedAt} format="YYYY-MM-DD"/></MetaInfo>
            <LWTooltip title={`This will be on the frontpage for ${duration} days when it rotates in`}>
              <MetaInfo>{duration} days</MetaInfo>
            </LWTooltip>
          </div>
        }
      </div>}
    </div>
  </AnalyticsTracker>
}

const SpotlightItemComponent = registerComponent('SpotlightItem', SpotlightItem, {styles});

declare global {
  interface ComponentTypes {
    SpotlightItem: typeof SpotlightItemComponent
  }
}

