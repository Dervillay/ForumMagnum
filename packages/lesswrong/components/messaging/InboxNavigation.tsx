import React from 'react';
import { useLocation, useNavigation } from '../../lib/routeUtil';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { useUpdate } from '../../lib/crud/withUpdate';
import { useMulti } from '../../lib/crud/withMulti';
import qs from 'qs'
import { forumTypeSetting } from '../../lib/instanceSettings';

// The Navigation for the Inbox components
const InboxNavigation = ({classes, terms, currentUser, title="Your Conversations"}: {
  classes: ClassesType,
  terms: ConversationsViewTerms,
  currentUser: UsersCurrent,
  title?: String
}) => {
  const location = useLocation();
  const { query } = location;
  const { history } = useNavigation();
  
  const { results, loading, loadMoreProps } = useMulti({
    terms,
    collectionName: "Conversations",
    fragmentName: 'conversationsListFragment',
    fetchPolicy: 'cache-and-network',
    limit: 50,
  });
  
  const { mutate: updateConversation } = useUpdate({
    collectionName: "Conversations",
    fragmentName: 'conversationsListFragment',
  });
  
  const { SectionTitle, SingleColumnSection, ConversationItem, Loading, SectionFooter, SectionFooterCheckbox, Typography, LoadMore } = Components
  
  const showArchive = query?.showArchive === "true"
  const expanded = query?.expanded === "true"

  const showArchiveCheckboxClick = () => {
    history.push({...location, search: `?${qs.stringify({showArchive: !showArchive})}`})
  }

  const expandCheckboxClick = () => {
    history.push({...location, search: `?${qs.stringify({expanded: !expanded})}`})
  }

  return (
    <SingleColumnSection>
        <SectionTitle title={title}>
          <SectionFooterCheckbox
            onClick={expandCheckboxClick}
            value={expanded}
            label={"Expand"}
          />
        </SectionTitle>
        {results?.length ?
          results.map(conversation => <ConversationItem key={conversation._id} conversation={conversation} updateConversation={updateConversation} currentUser={currentUser} expanded={expanded}/>
          ) :
          loading ? <Loading /> : <Typography variant="body2">You are all done! You have no more open conversations.{forumTypeSetting.get() !== "EAForum" && " Go and be free."}</Typography>
        }
        <SectionFooter>
          <LoadMore {...loadMoreProps} sectionFooterStyles/>
          <SectionFooterCheckbox
            onClick={showArchiveCheckboxClick}
            value={showArchive}
            label={"Show Archived Conversations"}
          />
        </SectionFooter>
    </SingleColumnSection>
  )
}

const InboxNavigationComponent = registerComponent('InboxNavigation', InboxNavigation);

declare global {
  interface ComponentTypes {
    InboxNavigation: typeof InboxNavigationComponent
  }
}
