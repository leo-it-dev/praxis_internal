import { WebdavSResource } from "./elements/storage_elements";

export class WebdavMemoryStorage {

    private resources: Map<string, WebdavSResource> = new Map();

    public registerResource(resource: WebdavSResource): boolean {
        if (this.resources.has(resource.resourceUri)) {
            return false;
        }
        this.resources.set(resource.resourceUri, resource);
        return true;
    }

    public getResource(path: string): WebdavSResource | undefined {
        return this.resources.has(path) ? this.resources.get(path) : undefined;
    }

    public dropResource(path: string): boolean {
        if (this.resources.has(path)) {
            this.resources.delete(path);
            return true;
        }
        return false;
    }
}