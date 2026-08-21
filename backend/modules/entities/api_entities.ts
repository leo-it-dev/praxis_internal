import { Mutex } from "async-mutex";
import { getRepeatedScheduler } from "../..";
import { ApiInterfaceEntitiesListOut } from "../../../api_common/api_customers";
import { ApiInterfaceEmptyIn } from "../../../api_common/backend_call";
import { Business } from "../../../api_common/generic_types/business";
import { Chunk, CombinedEntity } from "../../../api_common/generic_types/chunk";
import { Customer } from "../../../api_common/generic_types/customer";
import { Drug, DrugVerifiedState } from "../../../api_common/generic_types/drug";
import { UserPermission } from "../../../api_common/permission_types";
import { SqlUpdate } from "../../framework/sqlite_database";
import { ReadOnlyEntityDatabase, WritableHydrationDatabase } from "./entity_database";
import { HitDrugEntityDatabase, IntranetSqliteBusinessEntityDatabase, IntranetSqliteCustomerEntityDatabase, IntranetSqliteDrugEntityDatabase, MovetaBusinessEntityDatabase, MovetaCustomerEntityDatabase, MovetaDrugEntityDatabase } from "./entity_databases";
import { ApiModuleAuthorized } from "../../api_module";
const config = require('config');

type CombinedChunk<TDatabase> =
    TDatabase extends ReadOnlyEntityDatabase<
        infer CTX,
        infer TChunk
    >
    ? { [K in CTX]: TChunk }
    : never;

type UnionToIntersection<U> =
    (U extends unknown ? (x: U) => void : never) extends
    (x: infer I) => void
    ? I
    : never;

type EntityProvider<TPrimary extends ReadOnlyEntityDatabase<any, any>, TSecondary extends readonly WritableHydrationDatabase<any, any>[], TEntity extends CombinedEntity> = {
    sources: {
        primary: TPrimary;
        secondary: TSecondary;
    };

    combineEntities(chunks: (CombinedChunk<TPrimary> & UnionToIntersection<CombinedChunk<TSecondary[number]>>)[]): TEntity[];
    entities: TEntity[];
};

type EntityProviders = {
    customer: EntityProvider<MovetaCustomerEntityDatabase, [IntranetSqliteCustomerEntityDatabase], Customer>,
    business: EntityProvider<MovetaBusinessEntityDatabase, [IntranetSqliteBusinessEntityDatabase], Business>,
    drugs: EntityProvider<MovetaDrugEntityDatabase, [IntranetSqliteDrugEntityDatabase], Drug>,
    drugsExternal: EntityProvider<HitDrugEntityDatabase, [], Drug>,
};


export class ApiModuleEntities extends ApiModuleAuthorized {

    private updateEntityMutex = new Mutex();
    private entityProviders!: EntityProviders;

    private resolveEntitiesLoaded!: () => void;
    private entitiesLoadedPromise: Promise<void> = new Promise((res, rej) => {
        this.resolveEntitiesLoaded = res;
    });

    moduleInitialized(): void {
        this.entityProviders = {
            customer: {
                sources: {
                    primary: new MovetaCustomerEntityDatabase(),
                    secondary: [new IntranetSqliteCustomerEntityDatabase(this.sqlite())]
                },
                combineEntities(chunks) {
                    return chunks.map(chunk => ({
                        intranet: chunk.intranet,
                        moveta: chunk.moveta
                    }))
                },
                entities: [],
            },
            business: {
                sources: {
                    primary: new MovetaBusinessEntityDatabase(),
                    secondary: [new IntranetSqliteBusinessEntityDatabase(this.sqlite())]
                },
                combineEntities(chunks) {
                    return chunks.map(chunk => ({
                        intranet: chunk.intranet,
                        moveta: chunk.moveta
                    }))
                },
                entities: [],
            },
            drugs: {
                sources: {
                    primary: new MovetaDrugEntityDatabase(),
                    secondary: [new IntranetSqliteDrugEntityDatabase(this.sqlite())]
                },
                combineEntities(chunks) {
                    return chunks.map(chunk => ({
                        intranet: chunk.intranet,
                        moveta: chunk.moveta,
                        hit: {commonId: "", forms: [], name: "", znr: ""}
                    }))
                },
                entities: [],
            },
            drugsExternal: {
                sources: {
                    primary: new HitDrugEntityDatabase(),
                    secondary: []
                },
                combineEntities(chunks) {
                    return chunks.map(chunk => ({
                        hit: chunk.hit,
                        intranet: {commonId: "", reportabilityVerifierMarkedErronous: DrugVerifiedState.eNOT_TESTED},
                        moveta: {commonId: "", forms: [], name: "", shortsearch: "", znr: ""}
                    }))
                },
                entities: [],
            }
        };
    }

    protected sqliteTableCreate(): SqlUpdate[] | undefined {
        return [{
            params: [],
            update: "CREATE TABLE IF NOT EXISTS customers (\
                   kkenmoveta CHAR(8) PRIMARY KEY, \
                   image TEXT, \
                   nonpaying INTEGER NOT NULL, \
                   altgpsstreet VARCHAR(64), \
                   altgpsplz VARCHAR(64), \
                   altgpsplace VARCHAR(64)\
                );"
        },
        {
            params: [],
            update: "CREATE TABLE IF NOT EXISTS business (\
                   bkenmoveta CHAR(8) PRIMARY KEY, \
                   dummy CHAR(1) \
                );"
        },
        {
            params: [],
            update: "CREATE TABLE IF NOT EXISTS drugs (\
                   dkenmoveta CHAR(32) PRIMARY KEY, \
                   markedErronous INTEGER NOT NULL \
                );"
        },
        ]
    }

    modname(): string {
        return "entities";
    }

    permissionRequired(): UserPermission | undefined {
        return UserPermission.ENTITIES_LIST;
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceEntitiesListOut>("entities", async (req, user) => {
            return {
                statusCode: 200, responseObject: {
                    customers: this.entityProviders.customer.entities,
                    businesses: this.entityProviders.business.entities,
                    drugs: this.entityProviders.drugs.entities,
                    drugsExternal: this.entityProviders.drugsExternal.entities
                }, error: undefined
            };
        });
    }

    async initialize() {
        getRepeatedScheduler().scheduleRepeatedEvent(this, "entities-moveta-poll", config.get('movetaOdbcConnection.ENTITIES_POLL_INTERVAL_MINUTES') * 60, this.updateInternalEntitiesRepresentation.bind(this), true);
    }

    private async updateInternalEntitiesRepresentation(finished: () => void): Promise<void> {
        return new Promise(async (res, rej) => {
            await this.updateEntityMutex.acquire();
            this.buildCombinedEntitiesList().then(_ => {
                this.logger().info("Successfully updated internal entity representation!", { customerCount: this.entityProviders.customer.entities.length, businessCount: this.entityProviders.business.entities.length });
                this.resolveEntitiesLoaded();
            }).catch(error => {
                this.logger().error("An error occurred updating our internal entity representation!", { error: error });
            }).finally(() => {
                this.updateEntityMutex.release();
                finished();
            });
        });
    }

    private async buildCombinedEntitiesList(): Promise<void> {
        this.logger().info("Building entities view using pegasus and intranet data!.");

        try {
            await this.buildCombinedEntities("customers", this.entityProviders.customer);
            await this.buildCombinedEntities("businesses", this.entityProviders.business);
            await this.buildCombinedEntities("drugs", this.entityProviders.drugs);
            await this.buildCombinedEntities("drugsExternal", this.entityProviders.drugsExternal);
        } catch (err) {
            this.logger().error(
                "Error updating internal representation of databases! " +
                "Future database writes may fail! This should not happen!",
                { error: err }
            );
            throw err;
        }
    }

    private async buildCombinedEntities<
        TPrimary extends ReadOnlyEntityDatabase<any, any>,
        TSecondary extends readonly WritableHydrationDatabase<any, any>[],
        TEntity extends CombinedEntity>(context: string, provider: EntityProvider<TPrimary, TSecondary, TEntity>): Promise<void> {

        await this.acquireAllChunkSources(
            context,
            [
                provider.sources.primary,
                ...provider.sources.secondary
            ]
        );

        const combinedChunks = await this.combineDataSources(
            provider.sources.primary,
            provider.sources.secondary
        );

        provider.entities = provider.combineEntities(combinedChunks);
    }

    private async combineDataSources<TPrimary extends ReadOnlyEntityDatabase<any, any>, TSecondary extends readonly WritableHydrationDatabase<any, any>[]>(primary: TPrimary, secondary: TSecondary):
        Promise<Array<CombinedChunk<TPrimary> & UnionToIntersection<CombinedChunk<TSecondary[number]>>>> {
        type Result =
            CombinedChunk<TPrimary> &
            UnionToIntersection<CombinedChunk<TSecondary[number]>>;

        let entities: Result[] = [];

        // We got all data, now combine it into our internal entity with all information hydrated.
        // We still prioritize moveta, so we try to match each moveta customer chunk with an intranet customer chunk, if available.

        secondary.forEach(database => database.copyAcquisitionResultToMutableBuffer());

        for (let baseChunk of primary.getLastAcquisitionResult()) {
            // iterate over all chunk provider results and combine all of them

            let additionalProviderChunks: Record<string, Chunk> = {};

            for (let hydrationDatabase of secondary) {

                let providerEntity = hydrationDatabase.findAndPopChunk(baseChunk.commonId);
                if (!providerEntity) {
                    // We don't yet have an entry of the customer in our internal intranet database, add a new empty customer chunk entry to our database.
                    let defaultProviderEntityChunk = hydrationDatabase.constructDefaultChunk(baseChunk.commonId);
                    try {
                        await hydrationDatabase.addOrModify(defaultProviderEntityChunk);
                        this.logger().info("Inserted new empty intranet entity chunk into database!", { commonId: baseChunk.commonId })
                    } catch (err) {
                        this.logger().error("Error inserting new empty intranet entity chunk into database! We will retry on next sync cycle or if someone tries to modify intranet customer chunk information on the web interface!", { error: err, commonId: baseChunk.commonId })
                    }
                    providerEntity = defaultProviderEntityChunk;
                }
                additionalProviderChunks[hydrationDatabase.context] = providerEntity;
            }
            entities.push({ [primary.context]: baseChunk, ...additionalProviderChunks } as Result);
        }

        // Customers to delete on our intranet representation!
        // Moveta is still priority #1, therefore we delete all customer chunks on our end that don't have a corresponding moveta binding!
        // We already filtered out all customers that have a corresponding moveta entry, therefore we just delete all intranet customer chunks still left in our initial list.
        for (let hydrationDatabase of secondary) {
            let remainingDanglingChunks = hydrationDatabase.getRemainingMutableChunks();
            for (let danglingChunk of remainingDanglingChunks) {
                try {
                    await hydrationDatabase.deleteChunk(danglingChunk);
                    this.logger().info("Deleted unused intranet chunk from database!", { commonId: danglingChunk.commonId })
                } catch (err) {
                    this.logger().error("Error deleting intranet chunk from database!", { error: err, commonId: danglingChunk.commonId })
                }
            }
        }

        return entities;
    }

    private async acquireAllChunkSources(context: string, databases: ReadOnlyEntityDatabase<string, any>[]): Promise<void> {
        return new Promise(async (res, rej) => {
            this.logger().info("Acquiring all entity data from databases.", { databaseCount: databases.length, context: context });

            Promise.allSettled(databases.map(d => d.acquire())).then(results => {
                let logStr = "Read databases of context " + context + ": \n";
                let allSuccessfull = true;

                for (let database of databases) {
                    let dataChunks = results[databases.indexOf(database)];
                    if (dataChunks.status == "fulfilled") {
                        logStr += " - " + database.context + ": " + database.getLastAcquisitionResult().length + " " + context + " chunks";
                    } else {
                        logStr += " - " + database.context + ": error: " + dataChunks.reason.trim("\n") + "\n";
                        this.logger().error("Error receiving " + context + " chunks from provider!", { provider: database.context, reason: dataChunks.reason.trim("\n") });
                        allSuccessfull = false;
                    }
                }

                this.logger().info(logStr);
                this.logger().info("Received all " + context + "!");
                allSuccessfull ? res() : rej();
            });
        });
    }

    private async addOrStoreEntity<
        TPrimary extends ReadOnlyEntityDatabase<any, Chunk>,
        TSecondary extends WritableHydrationDatabase<any, Chunk>,
        TEntity extends CombinedEntity,
        TProvider extends EntityProvider<TPrimary, readonly TSecondary[], TEntity>>(
            entity: TEntity, databaseProvider: TProvider): Promise<void> {

        // First update our internal stored entity
        let storedEntity = this.entityProviders.customer.entities.find(entity => entity.moveta.commonId == entity.moveta.commonId);
        // Don't replace entity instance. Someone may still hold a reference to it that would otherwise not be updated.
        // Therefore we just update all object values.
        if (storedEntity !== undefined) {
            for(let [key, value] of Object.entries(entity)) {
                storedEntity[key] = value;
            }
        }

        // Second now we write the changes to all databases.
        for (let [context, dataChunk] of Object.entries(entity)) {
            let contextIsReadOnly = databaseProvider.sources.primary.context == context;
            if (contextIsReadOnly) {
                // This one data chunk belongs to the "root" primary database. Therefore we only have read access and couldn't write changes to the database provider anyway.
                 continue;
            }
            
            let responsibleDatabase = databaseProvider.sources.secondary.find(dataSource => dataSource.context == context);
            if (!responsibleDatabase) {
                this.logger().warn("Unknown state while trying to store entity back to database! No responsible database found for data chunk!", { entityType: "customer", chunkContext: context })
                continue;
            }
            responsibleDatabase.addOrModify(dataChunk);
        }
    }

    public async getCustomerEntries(): Promise<Customer[]> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        let entities = this.entityProviders.customer.entities;
        this.updateEntityMutex.release();
        return entities;
    }

    public async getBusinessEntries(): Promise<Business[]> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        let entities = this.entityProviders.business.entities;
        this.updateEntityMutex.release();
        return entities;
    }

    public async getDrugEntities(): Promise<Drug[]> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        let entities = this.entityProviders.drugs.entities;
        this.updateEntityMutex.release();
        return entities;
    }

    public async getExternalDrugEntities(): Promise<Drug[]> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        let entities = this.entityProviders.drugsExternal.entities;
        this.updateEntityMutex.release();
        return entities;
    }

    public async addOrUpdateCustomerEntry(entity: Customer): Promise<void> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        await this.addOrStoreEntity(entity, this.entityProviders.customer);
        this.updateEntityMutex.release();
    }
    public async addOrUpdateBusinessEntry(entity: Business): Promise<void> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        await this.addOrStoreEntity(entity, this.entityProviders.business);
        this.updateEntityMutex.release();
    }
    public async addOrUpdateDrugEntry(entity: Drug): Promise<void> {
        await this.entitiesLoadedPromise;
        await this.updateEntityMutex.acquire();
        await this.addOrStoreEntity(entity, this.entityProviders.drugs);
        this.updateEntityMutex.release();
    }
}