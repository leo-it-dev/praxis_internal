import { WebdavHref } from "./webdav_xmlelements";

/**
 * 4.2.  DAV:principal-URL

   A principal may have many URLs, but there must be one "principal URL"
   that clients can use to uniquely identify a principal.  This
   protected property contains the URL that MUST be used to identify
   this principal in an ACL request.  Support for this property is
   REQUIRED.

   <!ELEMENT principal-URL (href)>
 */
export class WebdavPrincipalURL {
    constructor(
        public principalURL: string
    ) {

    }
}

/**
 * 4.1.  DAV:alternate-URI-set

   This protected property, if non-empty, contains the URIs of network
   resources with additional descriptive information about the
   principal.  This property identifies additional network resources
   (i.e., it contains one or more URIs) that may be consulted by a
   client to gain additional knowledge concerning a principal.  One
   expected use for this property is the storage of an LDAP [RFC2255]
   scheme URL.  A user-agent encountering an LDAP URL could use LDAP
   [RFC2251] to retrieve additional machine-readable directory
   information about the principal, and display that information in its
   user interface.  Support for this property is REQUIRED, and the value
   is empty if no alternate URI exists for the principal.

   <!ELEMENT alternate-URI-set (href*)>
 */
export class WebdavAlternateURISet {
    constructor(
        public alternateURIset: WebdavHref[]
    ) {

    }
}

/**
 * 4.4.  DAV:group-membership

   This protected property identifies the groups in which the principal
   is directly a member.  Note that a server may allow a group to be a
   member of another group, in which case the DAV:group-membership of
   those other groups would need to be queried in order to determine the
   groups in which the principal is indirectly a member.  Support for
   this property is REQUIRED.

   <!ELEMENT group-membership (href*)>
 */
export class WebdavGroupMembership {
    constructor(
        public groupMembership: WebdavHref[]
    ) {

    }
}