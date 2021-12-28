import React from 'react';
import { Components, registerComponent } from '../../lib/vulcan-lib';
import { useCurrentUser } from './withUser';
import { useServerRequestStatus } from '../../lib/routeUtil'

const ErrorAccessDenied = () => {
  const { SingleColumnSection } = Components;
  const serverRequestStatus = useServerRequestStatus()
  const currentUser = useCurrentUser();
  if (serverRequestStatus) serverRequestStatus.status = 403
  
  if (currentUser) {
    return <SingleColumnSection>
      <div>Sorry, you don't have access to this page.</div>
    </SingleColumnSection>
  } else {
    return <SingleColumnSection>
      <div>Please log in to access this page.</div>
      <Components.WrappedLoginForm/>
    </SingleColumnSection>
  }
}

const ErrorAccessDeniedComponent = registerComponent("ErrorAccessDenied", ErrorAccessDenied);

declare global {
  interface ComponentTypes {
    ErrorAccessDenied: typeof ErrorAccessDeniedComponent
  }
}
