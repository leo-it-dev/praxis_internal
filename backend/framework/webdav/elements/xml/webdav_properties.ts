import { WebdavSResourceType } from "../storage_elements";
import { IWebdavSerializable, XmlNamespace } from "./webdav_xmlelements";

/**
 * Name:   resourcetype
 *
 * Purpose:   Specifies the nature of the resource.
 *
 * Protected:   SHOULD be protected.  Resource type is generally decided
 *    through the operation creating the resource (MKCOL vs PUT), not by
 *    PROPPATCH.
 *
 * COPY/MOVE behavior:   Generally a COPY/MOVE of a resource results in
 *    the same type of resource at the destination.
 *
 * Description:   MUST be defined on all DAV-compliant resources.  Each
 *    child element identifies a specific type the resource belongs to,
 *    such as 'collection', which is the only resource type defined by
 *    this specification (see Section 14.3).  If the element contains
 *    the 'collection' child element plus additional unrecognized
 *    elements, it should generally be treated as a collection.  If the
 *    element contains no recognized child elements, it should be
 *    treated as a non-collection resource.  The default value is empty.
 *    This element MUST NOT contain text or mixed content.  Any custom
 *    child element is considered to be an identifier for a resource
 *    type.
 *
 * Example: (fictional example to show extensibility)
 *
 *     <x:resourcetype xmlns:x="DAV:">
 *         <x:collection/>
 *         <f:search-results xmlns:f="http://www.example.com/ns"/>
 *     </x:resourcetype>
 */
export class WebdavResourceType implements IWebdavSerializable {
    constructor(
        public resourceType: WebdavSResourceType
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let serial = "";
        if (this.resourceType == WebdavSResourceType.COLLECTION) {
            serial = "<" + currentNamespace.nsName + "collection/>\r\n";
        }
        return serial;
    }
}