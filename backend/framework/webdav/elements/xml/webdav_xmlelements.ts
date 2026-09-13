import { WebdavResourceType } from "./webdav_properties";

export interface IWebdavSerializable {
    serialize(currentNamespace: XmlNamespace): string;
}
export interface IWebdavDeserializable<T> {
    deserialize(body: any, parentNamespace: XmlNamespace): T;
}

function buildTag(currentNamespace: XmlNamespace, parentNamespace: XmlNamespace|undefined, tagname: string): [string, string] {
    let openingTag = "<" + currentNamespace.nsName + tagname;
    if (parentNamespace && currentNamespace.nsName != parentNamespace.nsName) {
        openingTag += " xmlns:" + currentNamespace.nsName.split(":")[0] + "=\"" + currentNamespace.nsHref + "\""
    }
    openingTag += ">";
    let endTag = "</" + currentNamespace.nsName + tagname + ">";
    return [openingTag, endTag];
}

export enum WebdavPropfindRequestType {
    PROP = "PROP",
    PROPNAME = "PROPNAME",
    ALLPROP = "ALLPROP"
}

export enum WebdavPropfindDepth {
    D0 = "0",
    D1 = "1",
    DINFINITY = "infinity"
}

/**
 * @note No direct definition in RFC4918 as this is defined by XML
 */
export class XmlNamespace implements IWebdavDeserializable<XmlNamespace> {
    constructor(
        public nsName: string = "",
        public nsHref: string = ""
    ) {

    }

    deserialize(body: any, parentNamespace: XmlNamespace): XmlNamespace {
        this.nsName = parentNamespace.nsName;
        this.nsHref = parentNamespace.nsHref;
        if ("$" in body) {
            let attributeChild = body["$"];
            let ns = Object.entries(attributeChild).find(e => e[0].startsWith("xmlns:"));
            if (ns) {
                this.nsName = ns[0].split("xmlns:")[1] + ":";
                this.nsHref = ns[1] as string;
            }
        }
        return this;
    }
}

/**
  * Name:   status
  *
  * Purpose:   Holds a single HTTP status-line.
  *
  * Value:   status-line (defined in Section 6.1 of [RFC2616])
  *
  * @note <!ELEMENT status (#PCDATA) >
 */
export class WebdavStatus implements IWebdavSerializable {
    constructor(
        public httpStatusLine: string
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(currentNamespace, undefined, "status");
        return openTag + this.httpStatusLine + closeTag + "\r\n";
    }
}

/**
 *  Name:   href
 *
 *  Purpose:   MUST contain a URI or a relative reference.
 *
 *  Description:   There may be limits on the value of 'href' depending
 *     on the context of its use.  Refer to the specification text where
 *     'href' is used to see what limitations apply in each case.
 *
 *  Value:   Simple-ref
 *
 *
 * @note  <!ELEMENT href (#PCDATA)>
 */
export class WebdavHref implements IWebdavSerializable  {
    constructor(
        public href: string
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(currentNamespace, undefined, "href");
        return openTag + this.href + closeTag + "\r\n";
    }
}

/**
 *  Name:   error
 *
 *  Purpose:   Error responses, particularly 403 Forbidden and 409
 *     Conflict, sometimes need more information to indicate what went
 *     wrong.  In these cases, servers MAY return an XML response body
 *     with a document element of 'error', containing child elements
 *     identifying particular condition codes.
 *
 *  Description:   Contains at least one XML element, and MUST NOT
 *     contain text or mixed content.  Any element that is a child of the
 *     'error' element is considered to be a precondition or
 *     postcondition code.  Unrecognized elements MUST be ignored.
 *
 * @note <!ELEMENT error ANY >
 */
export class WebdavError implements IWebdavSerializable {
    constructor(
        public ns: XmlNamespace,
        public error: IWebdavSerializable
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(this.ns, currentNamespace, "error");
        return openTag + "\r\n" + this.error.serialize(this.ns) + "\r\n" + closeTag + "\r\n";
    }
}

/**
 * 
 *  Name:   prop
 *
 * Purpose:   Contains properties related to a resource.
 *
 *  Description:   A generic container for properties defined on
 *     resources.  All elements inside a 'prop' XML element MUST define
 *     properties related to the resource, although possible property
 *     names are in no way limited to those property names defined in
 *     this document or other standards.  This element MUST NOT contain
 *     text or mixed content.
 *
 * @note <!ELEMENT prop ANY >
 */
export class WebdavPropertyName implements IWebdavDeserializable<WebdavPropertyName> {
    constructor(
        public ns: XmlNamespace = new XmlNamespace("", ""),
        public propertyNames: string[] = []
    ) {

    }

    deserialize(body: any, parentNamespace: XmlNamespace): WebdavPropertyName {
        let propChild = Object.values(body)[0] as any;
        this.ns = new XmlNamespace().deserialize(propChild, parentNamespace);
        for (let object of Object.entries(propChild)) {
            if (object[0] == "$") continue;
            this.propertyNames.push(object[0].split(this.ns.nsName)[1]);
        }
        return this;
    }
}

export class WebdavPropertyValue implements IWebdavSerializable {
    constructor(
        public ns: XmlNamespace,
        public propertyName: string,
        public propertyValue: Uint8Array | IWebdavSerializable | undefined,
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        if (this.propertyValue) {
            let [openTag, closeTag] = buildTag(this.ns, currentNamespace, this.propertyName);
            let serial = openTag + "\r\n";
            if (this.propertyValue instanceof Uint8Array) {
                serial += new TextDecoder().decode(this.propertyValue);
            } else {
                serial += this.propertyValue.serialize(this.ns);
            }
            serial += closeTag + "\r\n";
            return serial;
        } else {
            return "<" + this.ns.nsName + this.propertyName + "/>\r\n";
        }
    }
}

/**
 * Name:   prop
 *
 * Purpose:   Contains properties related to a resource.
 *
 * Description:   A generic container for properties defined on
 *    resources.  All elements inside a 'prop' XML element MUST define
 *    properties related to the resource, although possible property
 *    names are in no way limited to those property names defined in
 *    this document or other standards.  This element MUST NOT contain
 *    text or mixed content.
 *
 * @note <!ELEMENT prop ANY >
 */
export class WebdavProperty implements IWebdavSerializable  {
    constructor(
        public ns: XmlNamespace,
        public propVals: WebdavPropertyValue[]
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(this.ns, currentNamespace, "prop");
        let serial = openTag + "\r\n";
        for (let prop of this.propVals) {
            serial += prop.serialize(this.ns);
        }
        serial += closeTag + "\r\n";
        return serial;
    }
}

/**
 * 
 * Name:   include
 *
 *  Purpose:   Any child element represents the name of a property to be
 *     included in the PROPFIND response.  All elements inside an
 *     'include' XML element MUST define properties related to the
 *     resource, although possible property names are in no way limited
 *     to those property names defined in this document or other
 *     standards.  This element MUST NOT contain text or mixed content.
 *
 * @note <!ELEMENT include ANY >
 */
export class WebdavInclude implements IWebdavDeserializable<WebdavInclude> {
    constructor(
        public propertyNames: string[] = []
    ) {

    }
    deserialize(body: any, parentNamespace: XmlNamespace): WebdavInclude {
        let includeChild = Object.values(body)[0] as any;
        for (let object of Object.entries(includeChild)) {
            let propertyName = object[0].split(parentNamespace.nsName)[1];
            this.propertyNames.push(propertyName);
        }
        return this;
    }
}

/**
 *  Name:   propfind
 *
 *  Purpose:   Specifies the properties to be returned from a PROPFIND
 *     method.  Four special elements are specified for use with
 *     'propfind': 'prop', 'allprop', 'include', and 'propname'.  If
 *     'prop' is used inside 'propfind', it MUST NOT contain property
 *     values.
 *
 * @note <!ELEMENT propfind ( propname | (allprop, include?) | prop ) >
 */
export class WebdavPropfind implements IWebdavDeserializable<WebdavPropfind> {
    constructor(
        public type: WebdavPropfindRequestType = WebdavPropfindRequestType.ALLPROP,
        public prop: WebdavPropertyName | undefined = undefined,
        public include: WebdavInclude | undefined = undefined,
        public ns: XmlNamespace = new XmlNamespace("", "")
    ) {

    }

    deserialize(body: any, parentNamespace: XmlNamespace): WebdavPropfind {
        let propfindChild = Object.values(body)[0] as any;

        let xmlNamespace = new XmlNamespace().deserialize(propfindChild, parentNamespace);
        if (xmlNamespace.nsName + "prop" in propfindChild) {
            this.type = WebdavPropfindRequestType.PROP;
            this.prop = new WebdavPropertyName().deserialize(propfindChild[xmlNamespace.nsName + "prop"], xmlNamespace);
        }
        if (xmlNamespace.nsName + "allprop" in propfindChild) {
            let xml = propfindChild[xmlNamespace.nsName + "allprop"];
            this.type = WebdavPropfindRequestType.ALLPROP;
            if (xmlNamespace.nsName + "include" in xml) {
                this.include = new WebdavInclude().deserialize(xml[xmlNamespace.nsName + "include"], xmlNamespace);
            }
        }
        if (xmlNamespace.nsName + "propname" in propfindChild) {
            this.type = WebdavPropfindRequestType.PROPNAME;
            // no body
        }

        this.ns = xmlNamespace;
        return this;
    }
}

/**
 * Name:   responsedescription
 *
 *  Purpose:   Contains information about a status response within a
 *     Multi-Status.
 *
 *  Description:   Provides information suitable to be presented to a
 *     user.
 * 
 * @note  <!ELEMENT responsedescription (#PCDATA) >
 */
export class WebdavResponseDescription implements IWebdavSerializable  {
    constructor(
        public responseDescription: string
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(currentNamespace, undefined, "responsedescription");
        return openTag + "\r\n" + this.responseDescription + "\r\n" + closeTag + "\r\n";
    }
}

/**
 * Name:   location
 *
 *  Purpose:   HTTP defines the "Location" header (see [RFC2616], Section
 *     14.30) for use with some status codes (such as 201 and the 300
 *     series codes).  When these codes are used inside a 'multistatus'
 *     element, the 'location' element can be used to provide the
 *     accompanying Location header value.
 *
 *  Description:   Contains a single href element with the same value
 *     that would be used in a Location header.
 *
 * @note <!ELEMENT location (href)>
 *
 */
export class WebdavLocation implements IWebdavSerializable  {
    constructor(
        public href: WebdavHref
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(currentNamespace, undefined, "location");
        return openTag + "\r\n" + this.href.serialize(currentNamespace) + "\r\n" + closeTag + "\r\n";
    }
}

/**
 * 
 *  Name:   response
 *
 *  Purpose:   Holds a single response describing the effect of a method
 *     on resource and/or its properties.
 *
 *  Description:   The 'href' element contains an HTTP URL pointing to a
 *     WebDAV resource when used in the 'response' container.  A
 *     particular 'href' value MUST NOT appear more than once as the
 *     child of a 'response' XML element under a 'multistatus' XML
 *     element.  This requirement is necessary in order to keep
 *     processing costs for a response to linear time.  Essentially, this
 *     prevents having to search in order to group together all the
 *     responses by 'href'.  There are, however, no requirements
 *     regarding ordering based on 'href' values.  The optional
 *     precondition/postcondition element and 'responsedescription' text
 *     can provide additional information about this resource relative to
 *     the request or result.
 *
 * @note <!ELEMENT response (href, ((href*, status)|(propstat+)),
 *          error?, responsedescription? , location?) >
 */
export class WebdavResponse implements IWebdavSerializable  {
    constructor(
        public href: WebdavHref[],
        public error: WebdavError | undefined,
        public responsedescription: WebdavResponseDescription | undefined,
        public location: WebdavLocation | undefined,
        public ns: XmlNamespace,
        public status: WebdavStatus | undefined, 
        public propstat: WebdavPropStat[]
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(this.ns, currentNamespace, "response");
        let serial = openTag + "\r\n";
        serial += this.href[0].serialize(this.ns);

        if (this.propstat.length > 0) {
            for (let propstat of this.propstat) {
                serial += propstat.serialize(this.ns);
            }
        } else {
            for (let i = 1; i < this.href.length; i++) {
                serial += this.href[i].serialize(this.ns);
            }
            serial += this.status!.serialize(this.ns);
        }
        if (this.error) {
            serial += this.error.serialize(this.ns);
        }
        if (this.responsedescription) {
            serial += this.responsedescription.serialize(this.ns);
        }
        if (this.location) {
            serial += this.location.serialize(this.ns);
        }

        serial += closeTag + "\r\n";
        return serial;
    }
}

/**
 * Name:   propstat
 *
 *  Purpose:   Groups together a prop and status element that is
 *     associated with a particular 'href' element.
 *
 *  Description:   The propstat XML element MUST contain one prop XML
 *     element and one status XML element.  The contents of the prop XML
 *     element MUST only list the names of properties to which the result
 *     in the status element applies.  The optional precondition/
 *     postcondition element and 'responsedescription' text also apply to
 *     the properties named in 'prop'.
 *
 * @note <!ELEMENT propstat (prop, status, error?, responsedescription?) >
 */
export class WebdavPropStat implements IWebdavSerializable  {
    constructor(
        public prop: WebdavProperty,
        public status: WebdavStatus,
        public responseDescription: WebdavResponseDescription | undefined
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(currentNamespace, undefined, "propstat");
        let serial = openTag + "\r\n";

        serial += this.prop.serialize(currentNamespace);

        serial += this.status.serialize(currentNamespace);
        if (this.responseDescription) {
            serial += this.responseDescription.serialize(currentNamespace);
        }
        serial += closeTag + "\r\n";
        return serial;
    }
}

/**
 * Name:   multistatus
 *
 *  Purpose:   Contains multiple response messages.
 *
 *  Description:   The 'responsedescription' element at the top level is
 *     used to provide a general message describing the overarching
 *     nature of the response.  If this value is available, an
 *     application may use it instead of presenting the individual
 *     response descriptions contained within the responses.
 *
 * @note <!ELEMENT multistatus (response*, responsedescription?)  >
 */
export class WebdavMultiStatus implements IWebdavSerializable  {
    constructor(
        public ns: XmlNamespace,
        public response: WebdavResponse[],
        public responseDescription: WebdavResponseDescription | undefined
    ) {

    }
    serialize(currentNamespace: XmlNamespace): string {
        let [openTag, closeTag] = buildTag(this.ns, currentNamespace, "multistatus");
        let serial = openTag + "\r\n";
        if (this.responseDescription) {
            serial += this.responseDescription.serialize(this.ns);
        }
        for (let response of this.response) {
            serial += response.serialize(this.ns);
        }

        serial += closeTag + "\r\n";
        return serial;
    }
}