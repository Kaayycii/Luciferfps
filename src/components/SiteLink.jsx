import React from 'react';
import {permittedPublicLink} from '../lib/public-links.js';
export default function SiteLink({href,children,content=false,...props}) {
  if (permittedPublicLink(href)) return <a href={href} {...props}>{children}</a>;
  // Keep news and stream cards readable, without a third-party destination.
  if (content) return <article className={props.className}>{children}</article>;
  return null;
}
