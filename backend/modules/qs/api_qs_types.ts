export type DrugPackage = {
    package: string;
	pid: number;
}

export type ReportableDrug = {
    znr: string;
    shortsearch: string | null;
    name: string;
    forms: Array<DrugPackage>;
};