export interface ApiModuleInterfaceF2B {
    cacheTillOnline: boolean;
} // Frontend to backend (request)
export interface ApiModuleInterfaceB2F {
} // Backend to frontend (response)

export interface ApiInterfaceEmptyIn extends ApiModuleInterfaceF2B {
    cacheTillOnline: false;
}
export interface ApiInterfaceEmptyOut extends ApiModuleInterfaceB2F {}

export interface ApiModuleResponse<T extends ApiModuleInterfaceB2F> {
    statusCode: number,
    responseObject: T,
    error: string
}

export interface ApiModuleBody {
    content: ApiModuleInterfaceB2F;
    error: string
}

export class RequestTyped<T extends ApiModuleInterfaceF2B> {
    request: any;
    get body(): T {
        return this.request.body as object as T;
    };

    constructor(req: any) {
        this.request = req;
    }
}
