export abstract class ApiModuleInterface {}

export interface ApiModuleResponse<T extends ApiModuleInterface> {
    statusCode: number,
    responseObject: T,
    error: string
}

export interface ApiModuleBody {
    content: ApiModuleInterface;
    error: string
}
