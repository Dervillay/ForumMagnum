import React, { useEffect, useRef, useState } from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { useCurrentTime } from '../../lib/utils/timeUtil';
import moment from 'moment';
import { userIsAllowedToComment } from '../../lib/collections/users/helpers';
import { useCurrentUser } from '../common/withUser';
import type { CommentTreeNode } from '../../lib/utils/unflatten';
import classNames from 'classnames';
import * as _ from 'underscore';

export const NEW_COMMENT_MARGIN_BOTTOM = "1.3em"

const styles = (theme: ThemeType): JssStyles => ({
  root: {
    fontWeight: 400,
    margin: "0px auto -15px auto", // -15px is to offset the padding in Layout so that this fills exactly the whole page
    ...theme.typography.commentStyle,
    position: "relative",
    display: 'flex',
    flexDirection: 'column'
  },
  maxWidthRoot: {
    maxWidth: 720,
  },
  inline: {
    display: 'inline',
    color: theme.palette.text.secondary,
  },
  clickToHighlightNewSince: {
    display: 'inline',
    color: theme.palette.text.secondary,
    "@media print": { display: "none" },
  },
  button: {
    color: theme.palette.lwTertiary.main,
  },
  newComment: {
    border: theme.palette.border.commentBorder,
    position: 'relative',
    borderRadius: 3,
    marginBottom: NEW_COMMENT_MARGIN_BOTTOM,
    marginTop: 10,
    "@media print": {
      display: "none"
    }
  },
  newCommentLabel: {
    paddingLeft: theme.spacing.unit*1.5,
    ...theme.typography.commentStyle,
    ...theme.typography.body2,
    fontWeight: 600,
    marginTop: 12
  },
  newCommentSublabel: {
    paddingLeft: theme.spacing.unit*1.5,
    ...theme.typography.commentStyle,
    color: theme.palette.grey[600],
    fontStyle: 'italic',
    marginTop: 4,
  }
})

interface CommentsTimelineSectionState {
  highlightDate: Date,
  anchorEl: any,
}

const CommentsTimelineSection = ({
  post,
  tag,
  commentCount,
  loadMoreCount = 10,
  totalComments,
  loadMoreComments,
  loadingMoreComments,
  comments,
  parentAnswerId,
  startThreadTruncated,
  newForm=true,
  classes,
  condensed=true,
}: {
  post?: PostsDetails,
  tag?: TagBasicInfo,
  commentCount: number,
  loadMoreCount: number,
  totalComments: number,
  loadMoreComments: any,
  loadingMoreComments: boolean,
  comments: Array<CommentTreeNode<CommentsList>>,
  parentAnswerId?: string,
  startThreadTruncated?: boolean,
  newForm: boolean,
  classes: ClassesType,
  condensed?: boolean,
}) => {
  const currentUser = useCurrentUser();
  
  const bodyRef = useRef<HTMLDivElement>(null)
  const [topAbsolutePosition, setTopAbsolutePosition] = useState(200)
  
  useEffect(() => {
    recalculateTopAbsolutePosition()
    window.addEventListener('resize', recalculateTopAbsolutePosition)
    return () => window.removeEventListener('resize', recalculateTopAbsolutePosition)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  const recalculateTopAbsolutePosition = () => {
    if (bodyRef.current && bodyRef.current.getBoundingClientRect().top !== topAbsolutePosition)
      setTopAbsolutePosition(bodyRef.current.getBoundingClientRect().top)
  }

  // TODO: Update "author has blocked you" message to include link to moderation guidelines (both author and LW)

  const postAuthor = post?.user || null;
  return (
    <div
      ref={bodyRef}
      className={classNames(classes.root, { [classes.maxWidthRoot]: !tag})}
      style={{ height: `calc(100vh - ${topAbsolutePosition}px)` }}
    >
      <Components.CommentsTimeline
        treeOptions={{
          post: post,
          postPage: true,
          tag: tag,
        }}
        comments={comments}
        startThreadTruncated={startThreadTruncated}
        parentAnswerId={parentAnswerId}
        nestedScroll={true}
        commentCount={commentCount}
        loadMoreCount={loadMoreCount}
        totalComments={totalComments}
        loadMoreComments={loadMoreComments}
        loadingMoreComments={loadingMoreComments}
      />
      {newForm && (!currentUser || !post || userIsAllowedToComment(currentUser, post, postAuthor)) && !post?.draft && (
        <div id="posts-thread-new-comment" className={classes.newComment}>
          {!condensed && <div className={classes.newCommentLabel}>New Comment</div>}
          <Components.CommentsNewForm
            post={post}
            tag={tag}
            prefilledProps={{
              parentAnswerId: parentAnswerId,
            }}
            type="comment"
            enableGuidelines={false}
          />
        </div>
      )}
      {currentUser && post && !userIsAllowedToComment(currentUser, post, postAuthor) && (
        <Components.CantCommentExplanation post={post} />
      )}
    </div>
  );
}

const CommentsTimelineSectionComponent = registerComponent("CommentsTimelineSection", CommentsTimelineSection, {styles});

declare global {
  interface ComponentTypes {
    CommentsTimelineSection: typeof CommentsTimelineSectionComponent,
  }
}

