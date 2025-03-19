export interface ApiModuleInterfaceF2B {
    cacheTillOnline: boolean; // True: the request won't be sent directly if offline session is used.
                                // False: the request is sent out even if an offline session is used. We expect the service-worker to respond in the offline case!
                                // Note: This request may be access restricted. In that case, if we are using an offline session but do have a network connection, the request will
                                //       fail with an 401 Unauthorized error, which sends the user straight to the login page. Unsaved content may be lost! Still, this is the only
                                //       plausible reaction we can do in this case.
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
