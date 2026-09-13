import { WebdavResourceType } from "./xml/webdav_properties";

export enum WebdavSResourceType {
    COLLECTION,
    RESOURCE
}


/**
 * This class defines a dead property of a WEBDAV resource stored in our local storage.
 */
export class WebdavSProperty {
    constructor(
        public propertyName: string,
        public propertyValue: Uint8Array
    ) {

    }
}

export class WebdavSResource {

    constructor(
        public resourceUri: string,
        public type: WebdavSResourceType,
        public properties: WebdavSProperty[] = [],
        public content: Uint8Array | undefined
    ) {

    }
}