import { IntranetBusinessChunk, MovetaBusinessChunk } from "../../../api_common/generic_types/business";
import { Chunk } from "../../../api_common/generic_types/chunk";
import { IntranetCustomerChunk, MovetaCustomerChunk } from "../../../api_common/generic_types/customer";
import { DrugVerifiedState, HitDrugChunk, IntranetDrugChunk, MovetaDrugChunk } from "../../../api_common/generic_types/drug";
import { readBusinessesFromMovetaDB, readCustomersFromMovetaDB, readReportableDrugListFromMovetaDB } from "../../framework/moveta/moveta_functions";
import { SQLiteDB } from "../../framework/sqlite_database";
import { readReportableDrugListFromHIT } from "../qs/hit_drug_crawler";
import { ReadOnlyEntityDatabase, WritableHydrationDatabase } from "./entity_database";

export class IntranetSqliteCustomerEntityDatabase extends WritableHydrationDatabase<"intranet", IntranetCustomerChunk> {
    readonly context = "intranet" as const;
    readonly databaseName = "customer" as const;

    constructor(private sqlite: SQLiteDB) {
        super();
    }

    async readAll(commonId: string|undefined): Promise<IntranetCustomerChunk[]> {
        return new Promise<IntranetCustomerChunk[]>(async (res, rej) => {
            try {
                let rows = commonId == undefined ? 
                    await this.sqlite.sqlFetchAll("SELECT * FROM customers;", []) : 
                    await this.sqlite.sqlFetchAll("SELECT * FROM customers WHERE kkenmoveta=?;", [commonId]);
                let customerChunks: IntranetCustomerChunk[] = rows.map(row => {
                    return {
                        commonId: (row as any)['kkenmoveta'],
                        image: (row as any)['image'],
                        nonpaying: (row as any)['nonpaying'] == 1,
                        altgpsplace: (row as any)['altgpsplace'],
                        altgpsplz: (row as any)['altgpsplz'],
                        altgpsstreet: (row as any)['altgpsstreet'],
                    }
                });
                res(customerChunks);
            } catch (err) {
                rej(err);
            }
        });
    }

    async addOrModify(chunk: IntranetCustomerChunk): Promise<number> {
        return new Promise<number>(async (res, rej) => {
            try {
                await this.sqlite.sqlUpdate({
                    params: [chunk.commonId, chunk.image, chunk.nonpaying, chunk.altgpsstreet, chunk.altgpsplz, chunk.altgpsplace],
                    update: "INSERT OR REPLACE INTO customers(kkenmoveta, image, nonpaying, altgpsstreet, altgpsplz, altgpsplace) VALUES (?, ?, ?, ?, ?, ?)"
                });
                let row = await this.sqlite.sqlFetchFirst("SELECT last_insert_rowid()", []) as any;
                res(row["last_insert_rowid()"]);
            } catch (err) {
                rej(err);
            }
        });
    }

    async deleteChunk(chunk: IntranetCustomerChunk): Promise<void> {
        return new Promise<void>(async (res, rej) => {
            try {
                await this.sqlite.sqlUpdate({
                    params: [chunk.commonId],
                    update: "DELETE FROM customers WHERE kkenmoveta=?;"
                });
                res();
            } catch (err) {
                rej(err);
            }
        });
    }

    constructDefaultChunk(commonId: string) {
        return {
            commonId: commonId,
            altgpsplace: undefined,
            altgpsplz: undefined,
            altgpsstreet: undefined,
            image: undefined,
            nonpaying: false
        }
    }
}

export class IntranetSqliteBusinessEntityDatabase extends WritableHydrationDatabase<"intranet", IntranetBusinessChunk> {
    readonly context = "intranet" as const;
    readonly databaseName = "business" as const;

    constructor(private sqlite: SQLiteDB) {
        super();
    }

    async readAll(commonId: string|undefined): Promise<IntranetBusinessChunk[]> {
        return new Promise<IntranetBusinessChunk[]>(async (res, rej) => {
            try {
                let rows = commonId == undefined ? await this.sqlite.sqlFetchAll("SELECT * FROM business;", [])
                                                :  await this.sqlite.sqlFetchAll("SELECT * FROM business WHERE bkenmoveta=?;", [commonId]);
                let businessChunks: IntranetBusinessChunk[] = rows.map(row => {
                    return {
                        commonId: (row as any)['bkenmoveta'],
                        dummy: ""
                    }
                });
                res(businessChunks);
            } catch (err) {
                rej(err);
            }
        });
    }

    async addOrModify(chunk: IntranetBusinessChunk): Promise<number> {
        return new Promise<number>(async (res, rej) => {
            try {
                await this.sqlite.sqlUpdate({
                    params: [chunk.commonId],
                    update: "INSERT OR REPLACE INTO business(bkenmoveta) VALUES (?)"
                });
                let row = await this.sqlite.sqlFetchFirst("SELECT last_insert_rowid()", []) as any;
                res(row["last_insert_rowid()"]);
            } catch (err) {
                rej(err);
            }
        });
    }

    async deleteChunk(chunk: IntranetBusinessChunk): Promise<void> {
        return new Promise<void>(async (res, rej) => {
            try {
                await this.sqlite.sqlUpdate({
                    params: [chunk.commonId],
                    update: "DELETE FROM business WHERE bkenmoveta=?;"
                });
                res();
            } catch (err) {
                rej(err);
            }
        });
    }

    constructDefaultChunk(commonId: string) {
        return {
            commonId: commonId,
            dummy: ""
        }
    }
}

export class MovetaCustomerEntityDatabase extends ReadOnlyEntityDatabase<"moveta", MovetaCustomerChunk> {
    readonly context = "moveta" as const;
    readonly databaseName = "customer" as const;

    constructor() {
        super();
    }

    async readAll(commonId: string|undefined): Promise<MovetaCustomerChunk[]> {
        return readCustomersFromMovetaDB(commonId);
    }
}

export class MovetaBusinessEntityDatabase extends ReadOnlyEntityDatabase<"moveta", MovetaBusinessChunk> {
    readonly context = "moveta" as const;
    readonly databaseName = "business" as const;

    constructor() {
        super();
    }

    async readAll(commonId: string|undefined): Promise<MovetaBusinessChunk[]> {
        return readBusinessesFromMovetaDB(commonId);
    }
}

export class IntranetSqliteDrugEntityDatabase extends WritableHydrationDatabase<"intranet", IntranetDrugChunk> {
    readonly context = "intranet" as const;
    readonly databaseName = "drug" as const;

    constructor(private sqlite: SQLiteDB) {
        super();
    }

    async readAll(commonId: string|undefined): Promise<IntranetDrugChunk[]> {
        return new Promise<IntranetDrugChunk[]>(async (res, rej) => {
            try {
                let rows = commonId == undefined ? await this.sqlite.sqlFetchAll("SELECT * FROM drugs;", []) 
                                                : await this.sqlite.sqlFetchAll("SELECT * FROM drugs WHERE dkenmoveta=?;", [commonId]);
                let drugChunks: IntranetDrugChunk[] = rows.map(row => {
                    return {
                        commonId: (row as any)['dkenmoveta'],
                        reportabilityVerifierMarkedErronous: (row as any)['markedErronous'],
                    }
                });
                res(drugChunks);
            } catch (err) {
                rej(err);
            }
        });
    }

    async addOrModify(chunk: IntranetDrugChunk): Promise<number> {
        return new Promise<number>(async (res, rej) => {
            try {
                await this.sqlite.sqlUpdate({
                    params: [chunk.commonId, chunk.reportabilityVerifierMarkedErronous],
                    update: "INSERT OR REPLACE INTO drugs(dkenmoveta, markedErronous) VALUES (?, ?)"
                });
                let row = await this.sqlite.sqlFetchFirst("SELECT last_insert_rowid()", []) as any;
                res(row["last_insert_rowid()"]);
            } catch (err) {
                rej(err);
            }
        });
    }

    async deleteChunk(chunk: IntranetDrugChunk): Promise<void> {
        return new Promise<void>(async (res, rej) => {
            try {
                await this.sqlite.sqlUpdate({
                    params: [chunk.commonId],
                    update: "DELETE FROM drugs WHERE dkenmoveta=?;"
                });
                res();
            } catch (err) {
                rej(err);
            }
        });
    }

    constructDefaultChunk(commonId: string) {
        return {
            commonId: commonId,
            reportabilityVerifierMarkedErronous: DrugVerifiedState.eNOT_TESTED
        }
    }
}

export class MovetaDrugEntityDatabase extends ReadOnlyEntityDatabase<"moveta", MovetaDrugChunk> {
    readonly context = "moveta" as const;
    readonly databaseName = "drug" as const;

    constructor() {
        super();
    }

    async readAll(commonId: string|undefined): Promise<MovetaDrugChunk[]> {
        return readReportableDrugListFromMovetaDB(commonId);
    }
}

export class HitDrugEntityDatabase extends ReadOnlyEntityDatabase<"hit", HitDrugChunk & MovetaDrugChunk & IntranetDrugChunk> {
    readonly context = "hit" as const;
    readonly databaseName = "drug" as const;

    constructor() {
        super();
    }

    async readAll(_: string|undefined): Promise<(HitDrugChunk & MovetaDrugChunk & IntranetDrugChunk)[]> {
        let drugs = await readReportableDrugListFromHIT();
        return drugs.map(drug => {
            return {
                ...drug,
                shortsearch: "",
                reportabilityVerifierMarkedErronous: DrugVerifiedState.eVERIFIED_SUCCESSFULLY_REPORTABLE,
            };
        });
    }
}

export class DummyEntityDatabase extends WritableHydrationDatabase<"dummy", Chunk> {
    readonly context = "dummy" as const;
    readonly databaseName = "dummy" as const;

    constructor() {
        super();
    }

    async readAll(_: string|undefined): Promise<IntranetDrugChunk[]> {
        return new Promise<IntranetDrugChunk[]>(async (res, rej) => {
            res([]);
        });
    }

    async addOrModify(chunk: IntranetDrugChunk): Promise<number> {
        return new Promise<number>(async (res, rej) => {
            res(-1);
        });
    }

    async deleteChunk(chunk: IntranetDrugChunk): Promise<void> {
        return new Promise<void>(async (res, rej) => {
            res();
        });
    }

    constructDefaultChunk(commonId: string) {
        return {
            commonId: commonId,
        }
    }
}
