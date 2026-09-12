import { Mutex } from "async-mutex";
import { isDeepStrictEqual } from "util";
import { getRepeatedScheduler } from "../..";
import { ApiInterfaceEntitiesListOut, ApiInterfacePatchBusinessIn, ApiInterfacePatchBusinessOut, ApiInterfacePatchCustomerIn, ApiInterfacePatchCustomerOut, ApiInterfacePatchDrugIn, ApiInterfacePatchDrugOut } from "../../../api_common/api_entities";
import { ApiInterfaceEmptyIn } from "../../../api_common/backend_call";
import { Business } from "../../../api_common/generic_types/business";
import { Chunk, CombinedEntity, EntityType } from "../../../api_common/generic_types/chunk";
import { Customer } from "../../../api_common/generic_types/customer";
import { Drug } from "../../../api_common/generic_types/drug";
import { UserPermission } from "../../../api_common/permission_types";
import { ApiModuleAuthorized } from "../../api_module";
import { SqlUpdate } from "../../framework/sqlite_database";
import { ReadOnlyEntityDatabase, WritableHydrationDatabase } from "./entity_database";
import { DummyEntityDatabase, HitDrugEntityDatabase, IntranetSqliteBusinessEntityDatabase, IntranetSqliteCustomerEntityDatabase, IntranetSqliteDrugEntityDatabase, MovetaBusinessEntityDatabase, MovetaCustomerEntityDatabase, MovetaDrugEntityDatabase } from "./entity_databases";
const config = require('config');

type Combine<
  TPrimary,
  TSecondary extends readonly unknown[]
> =
  TSecondary extends readonly []
    ? TPrimary
    : TPrimary & TSecondary[number];

type EntityOf<T> =
  T extends ReadOnlyEntityDatabase<any, infer TEntity>
    ? TEntity
    : T extends WritableHydrationDatabase<any, infer TEntity>
      ? TEntity
      : Chunk;

      
type EntityProvider<TPrimary extends ReadOnlyEntityDatabase<any, any>, TSecondary extends readonly WritableHydrationDatabase<any, any>[], TEntity extends Combine<EntityOf<TPrimary>, EntityOf<TSecondary[number]>>> = {
    sources: {
        primary: TPrimary;
        secondary: TSecondary;
    };
    entities: TEntity[];
};


type EntityProviders = {
    customer: EntityProvider<MovetaCustomerEntityDatabase, [IntranetSqliteCustomerEntityDatabase], Customer>,
    business: EntityProvider<MovetaBusinessEntityDatabase, [IntranetSqliteBusinessEntityDatabase], Business>,
    drugs: EntityProvider<MovetaDrugEntityDatabase, [IntranetSqliteDrugEntityDatabase], Drug>,
    drugsExternal: EntityProvider<HitDrugEntityDatabase, [DummyEntityDatabase], Drug>,
};

type DataSourceCombinationResult<TPrimary extends ReadOnlyEntityDatabase<any, any>, TChunk extends Chunk, TSecondary extends readonly WritableHydrationDatabase<any, TChunk>[]> = {
    combinedEntities: Array<Combine<TPrimary, TSecondary>>;
    deletedEntities: Set<string>;
    newlyAddedEntities: Set<string>;
}
type EntityCombinationResult<
    TPrimary extends ReadOnlyEntityDatabase<any, any>, 
    TSecondary extends readonly WritableHydrationDatabase<any, any>[], 
    TEntity extends Combine<EntityOf<TPrimary>, EntityOf<TSecondary[number]>>> = {

    entity: TEntity|undefined;
    deletedEntities: Set<string>;
    newlyAddedEntities: Set<string>;
}
type EntityStoreResult<
    TPrimary extends ReadOnlyEntityDatabase<any, any>, 
    TSecondary extends readonly WritableHydrationDatabase<any, any>[], 
    TEntity extends Combine<EntityOf<TPrimary>, EntityOf<TSecondary[number]>>,
    TProvider extends EntityProvider<TPrimary, TSecondary, TEntity>> = {

    entity: TEntity|undefined;
    deletedEntities: Set<string>
    newlyAddedEntities: Set<string>;
}


export interface IEntityUpdate {
    entityModified(entityType: EntityType, entity: CombinedEntity): void;
    entityDeleted(entityType: EntityType, commonId: string): void;
    entityAdded(entityType: EntityType, commonId: string): void;
}

export class ApiModuleEntities extends ApiModuleAuthorized {

    private updateEntityMutex = new Mutex();
    private entityProviders!: EntityProviders;
    private dataObservers: IEntityUpdate[] = [];

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
                entities: [],
            },
            business: {
                sources: {
                    primary: new MovetaBusinessEntityDatabase(),
                    secondary: [new IntranetSqliteBusinessEntityDatabase(this.sqlite())]
                },
                entities: [],
            },
            drugs: {
                sources: {
                    primary: new MovetaDrugEntityDatabase(),
                    secondary: [new IntranetSqliteDrugEntityDatabase(this.sqlite())]
                },
                entities: [],
            },
            drugsExternal: {
                sources: {
                    primary: new HitDrugEntityDatabase(),
                    secondary: [new DummyEntityDatabase()]
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
                   changed DATETIME NOT NULL, \
                   image TEXT, \
                   nonpaying INTEGER NOT NULL, \
                   altgpsstreet VARCHAR(64), \
                   altgpsplz NUMBER, \
                   altgpsplace VARCHAR(64)\
                );"
        },
        {
            params: [],
            update: "CREATE TABLE IF NOT EXISTS business (\
                   bkenmoveta CHAR(8) PRIMARY KEY, \
                   changed DATETIME, \
                   dummy CHAR(1) \
                );"
        },
        {
            params: [],
            update: "CREATE TABLE IF NOT EXISTS drugs (\
                   dkenmoveta CHAR(32) PRIMARY KEY, \
                   changed DATETIME, \
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
        this.postJson<ApiInterfacePatchBusinessIn, ApiInterfacePatchBusinessOut>("patch-business", async (req, user) => {
            let business = req.body.business;
            try {
                let localBusiness = this.entityProviders.business.entities.find(locEntity => locEntity.commonId == business.commonId);
                if (!localBusiness) {
                    return { error: "Business to patch does not exist with given commonId!", responseObject: undefined, statusCode: 400};
                }
                if (localBusiness.changed != business.changed && !req.body.forcePush) {
                    let localBusinessEqualityCheck = {...localBusiness};
                    localBusinessEqualityCheck.changed = business.changed;
                    if(!isDeepStrictEqual(localBusinessEqualityCheck, business)) {
                        return { error: undefined, responseObject: {mergeConflict: true, businessReadback: localBusiness}, statusCode: 200};
                    }
                }

                let patchedBusiness = await this.addOrUpdateBusinessEntry(business);
                if (patchedBusiness === undefined) {
                    this.logger().info("Error patching business entry! Seems like it worked, but readback failed!", {business: business});
                    return { error: "Error reading back business!", responseObject: undefined, statusCode: 500};
                } else {
                    this.logger().info("Successfully wrote business patch to database!", {business: business});
                    return { error: undefined, responseObject: {businessReadback: patchedBusiness, mergeConflict: false}, statusCode: 200};
                }
            } catch(err) {
                this.logger().error("Error writing business patch to database!", {business: business, error: err});
                return { error: "Error updating business!", responseObject: undefined, statusCode: 500};
            }
        });
        this.postJson<ApiInterfacePatchCustomerIn, ApiInterfacePatchCustomerOut>("patch-customer", async (req, user) => {
            let customer = req.body.customer;
            try {
                let localCustomer = this.entityProviders.customer.entities.find(locEntity => locEntity.commonId == customer.commonId);
                if (!localCustomer) {
                    return { error: "Customer to patch does not exist with given commonId!", responseObject: undefined, statusCode: 400};
                }
                if (localCustomer.changed != customer.changed && !req.body.forcePush) {
                    let localCustomerEqualityCheck = {...localCustomer};
                    localCustomerEqualityCheck.changed = customer.changed;
                    if(!isDeepStrictEqual(localCustomerEqualityCheck, customer)) {
                        return { error: undefined, responseObject: {customerReadback: localCustomer, mergeConflict: true}, statusCode: 200};
                    }
                }

                let patchedCustomer = await this.addOrUpdateCustomerEntry(customer);
                if (patchedCustomer === undefined) {
                    this.logger().info("Error patching customer entry! Seems like it worked, but readback failed!", {customer: customer});
                    return { error: "Error reading back customer!", responseObject: undefined, statusCode: 500};
                } else {
                    this.logger().info("Successfully wrote customer patch to database!", {customer: customer});
                    return { error: undefined, responseObject: {customerReadback: patchedCustomer, mergeConflict: false}, statusCode: 200};
                }
            } catch(err) {
                this.logger().error("Error writing customer patch to database!", {customer: customer, error: err});
                return { error: "Error updating customer!", responseObject: undefined, statusCode: 500};
            }
        });
        this.postJson<ApiInterfacePatchDrugIn, ApiInterfacePatchDrugOut>("patch-drug", async (req, user) => {
            let drug = req.body.drug;
            try {
                let localDrug = this.entityProviders.drugs.entities.find(locEntity => locEntity.commonId == drug.commonId);
                if (!localDrug) {
                    return { error: "Drug to patch does not exist with given commonId!", responseObject: undefined, statusCode: 400};
                }
                if (localDrug.changed != drug.changed && !req.body.forcePush) {
                    let localDrugEqualityCheck = {...localDrug};
                    localDrugEqualityCheck.changed = drug.changed;
                    if(!isDeepStrictEqual(localDrugEqualityCheck, drug)) {
                        return { error: undefined, responseObject: {drugReadback: localDrug, mergeConflict: true}, statusCode: 200};
                    }
                }

                let patchedDrug = await this.addOrUpdateDrugEntry(drug);
                if (patchedDrug === undefined) {
                    this.logger().info("Error patching drug entry! Seems like it worked, but readback failed!", {drug: drug});
                    return { error: "Error reading back drug!", responseObject: undefined, statusCode: 500};
                } else {
                    this.logger().info("Successfully wrote drug patch to database!", {drug: drug});
                    return { error: undefined, responseObject: {drugReadback: patchedDrug, mergeConflict: false}, statusCode: 200};
                }
            } catch(err) {
                this.logger().error("Error writing drug patch to database!", {drug: drug, error: err});
                return { error: "Error updating drug!", responseObject: undefined, statusCode: 500};
            }
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
            let customerData = (await this.buildCombinedEntities("customers", this.entityProviders.customer, undefined));
            customerData.deletedEntities.forEach(c => this.dataObservers.forEach(obs => obs.entityDeleted(EntityType.CUSTOMER, c)));
            customerData.newlyAddedEntities.forEach(c => this.dataObservers.forEach(obs => obs.entityAdded(EntityType.CUSTOMER, c)));
            let businessData = (await this.buildCombinedEntities("businesses", this.entityProviders.business, undefined));
            businessData.deletedEntities.forEach(c => this.dataObservers.forEach(obs => obs.entityDeleted(EntityType.BUSINESS, c)));
            businessData.newlyAddedEntities.forEach(c => this.dataObservers.forEach(obs => obs.entityAdded(EntityType.BUSINESS, c)));
            let drugData = (await this.buildCombinedEntities("drugs", this.entityProviders.drugs, undefined));
            drugData.deletedEntities.forEach(c => this.dataObservers.forEach(obs => obs.entityDeleted(EntityType.DRUG, c)));
            drugData.newlyAddedEntities.forEach(c => this.dataObservers.forEach(obs => obs.entityAdded(EntityType.DRUG, c)));
            await this.buildCombinedEntities("drugsExternal", this.entityProviders.drugsExternal, undefined);
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
        TEntity extends Combine<EntityOf<TPrimary>, EntityOf<TSecondary[number]>>>(context: string, provider: EntityProvider<TPrimary, TSecondary, TEntity>, commonIdFilter: string|undefined): 
        Promise<EntityCombinationResult<TPrimary, TSecondary, TEntity>> {

        await this.acquireAllChunkSources(
            context,
            [
                provider.sources.primary,
                ...provider.sources.secondary
            ],
            commonIdFilter
        );

        const combinedChunks = await this.combineDataSources(
            provider.sources.primary,
            provider.sources.secondary
        );

        // if we just want to update one entity we set commonIdFilter != undefined.
        // If it is undefined we updated all entities, so we store all new entities.
        if (commonIdFilter === undefined) {
            provider.entities = combinedChunks.combinedEntities as TEntity;
            return {
                entity: undefined,
                deletedEntities: combinedChunks.deletedEntities,
                newlyAddedEntities: combinedChunks.newlyAddedEntities
            }
        } else {
            // here we just want to update one entity.
            // Therefore we search for the old one and replace it.
            let providerOldEntityIdx = provider.entities.findIndex(entity => entity.commonId == commonIdFilter);
            if (providerOldEntityIdx != -1) {
                Object.assign(provider.entities[providerOldEntityIdx], combinedChunks.combinedEntities[0] as TEntity)
                return {
                    entity: provider.entities[providerOldEntityIdx],
                    deletedEntities: combinedChunks.deletedEntities,
                    newlyAddedEntities: combinedChunks.newlyAddedEntities
                }
            }
        }

        return {
            entity: undefined,
            deletedEntities: new Set(),
            newlyAddedEntities: new Set()
        }
    }

    private async combineDataSources<TPrimary extends ReadOnlyEntityDatabase<any, any>, TChunk extends Chunk, TSecondary extends readonly WritableHydrationDatabase<any, TChunk>[]>(primary: TPrimary, secondary: TSecondary):
        Promise<DataSourceCombinationResult<TPrimary, TChunk, TSecondary>> {
        type Result = Combine<TPrimary, TSecondary>;
        let entities: Result[] = [];
        let deletedEntities: Set<string> = new Set();
        let newlyAddedEntities: Set<string> = new Set();

        // We got all data, now combine it into our internal entity with all information hydrated.
        // We still prioritize moveta, so we try to match each moveta customer chunk with an intranet customer chunk, if available.

        secondary.forEach(database => database.copyAcquisitionResultToMutableBuffer());

        for (let baseChunk of primary.getLastAcquisitionResult()) {
            // iterate over all chunk provider results and combine all of them

            let entity = {};

            for (let hydrationDatabase of secondary) {
                if (hydrationDatabase instanceof DummyEntityDatabase) {
                    continue;
                }

                let providerEntity = hydrationDatabase.findAndPopChunk(baseChunk.commonId);
                if (!providerEntity) {
                    // We don't yet have an entry of the customer in our internal intranet database, add a new empty customer chunk entry to our database.
                    let defaultProviderEntityChunk = hydrationDatabase.constructDefaultChunk(baseChunk.commonId);
                    try {
                        newlyAddedEntities.add(baseChunk.commonId);
                        await hydrationDatabase.addOrModify(defaultProviderEntityChunk);
                        this.logger().info("Inserted new empty intranet entity chunk into database!", { commonId: baseChunk.commonId })
                    } catch (err) {
                        this.logger().error("Error inserting new empty intranet entity chunk into database! We will retry on next sync cycle or if someone tries to modify intranet customer chunk information on the web interface!", { error: err, commonId: baseChunk.commonId })
                    }
                    providerEntity = defaultProviderEntityChunk;
                }
                Object.assign(entity, providerEntity);
            }
            entities.push({ ...baseChunk, ...entity } as Result);
        }

        // Customers to delete on our intranet representation!
        // Moveta is still priority #1, therefore we delete all customer chunks on our end that don't have a corresponding moveta binding!
        // We already filtered out all customers that have a corresponding moveta entry, therefore we just delete all intranet customer chunks still left in our initial list.
        for (let hydrationDatabase of secondary) {
            let remainingDanglingChunks = hydrationDatabase.getRemainingMutableChunks();
            for (let danglingChunk of remainingDanglingChunks) {
                try {
                    await hydrationDatabase.deleteChunk(danglingChunk);
                    deletedEntities.add(danglingChunk.commonId);
                    this.logger().info("Deleted unused intranet chunk from database!", { commonId: danglingChunk.commonId })
                } catch (err) {
                    this.logger().error("Error deleting intranet chunk from database!", { error: err, commonId: danglingChunk.commonId })
                }
            }
        }

        return {
            combinedEntities: entities,
            deletedEntities: deletedEntities,
            newlyAddedEntities: newlyAddedEntities
        } as DataSourceCombinationResult<TPrimary, TChunk, TSecondary>;
    }

    private async acquireAllChunkSources(context: string, databases: ReadOnlyEntityDatabase<string, any>[], commonIdFilter: string|undefined): Promise<void> {
        return new Promise(async (res, rej) => {
            this.logger().info("Acquiring all entity data from databases.", { databaseCount: databases.length, context: context });

            Promise.allSettled(databases.map(d => d.acquire(commonIdFilter))).then(results => {
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
        TPrimary extends ReadOnlyEntityDatabase<any, any>, 
        TSecondary extends readonly WritableHydrationDatabase<any, any>[], 
        TEntity extends Combine<EntityOf<TPrimary>, EntityOf<TSecondary[number]>>,
        TProvider extends EntityProvider<TPrimary, TSecondary, TEntity>>(
            entity: TEntity, databaseProvider: TProvider): Promise<EntityStoreResult<TPrimary, TSecondary, TEntity, TProvider>> {

        // Write the changes to all databases.
        databaseProvider.sources.secondary.forEach(sec => {
            sec.addOrModify(entity);
        })

        // The change may not have updated all given fields in the databases (=> ReadOnlyDatabase...). Therefore we don't blindly replace our local object values,
        // instead we update that one entity by freshly constructing it from it's database providers.
        // This function also updates our internal object reference so all handles are still valid to that entity.
        return await this.buildCombinedEntities("single-update", databaseProvider, entity.commonId);
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

    public async addOrUpdateCustomerEntry(entity: Customer): Promise<Customer | undefined> {
        await this.entitiesLoadedPromise;
        return this.updateEntityMutex.runExclusive(async () => {
            let cb = await this.addOrStoreEntity(entity, this.entityProviders.customer);
            this.dataObservers.forEach(obs => {
                cb.newlyAddedEntities.forEach(newE => obs.entityAdded(EntityType.CUSTOMER, newE));
                cb.deletedEntities.forEach(newE => obs.entityDeleted(EntityType.CUSTOMER, newE));
                obs.entityModified(EntityType.CUSTOMER, entity);
            });
            return cb.entity;
        });
    }
    public async addOrUpdateBusinessEntry(entity: Business): Promise<Business | undefined> {
        await this.entitiesLoadedPromise;
        return this.updateEntityMutex.runExclusive(async () => {
            let cb = await this.addOrStoreEntity(entity, this.entityProviders.business)
            this.dataObservers.forEach(obs => {
                cb.newlyAddedEntities.forEach(newE => obs.entityAdded(EntityType.BUSINESS, newE));
                cb.deletedEntities.forEach(newE => obs.entityDeleted(EntityType.BUSINESS, newE));
                obs.entityModified(EntityType.BUSINESS, entity);
            });
            return cb.entity;
        });
    }
    public async addOrUpdateDrugEntry(entity: Drug): Promise<Drug | undefined> {
        await this.entitiesLoadedPromise;
        return this.updateEntityMutex.runExclusive(async () => {
            let cb = await this.addOrStoreEntity(entity, this.entityProviders.drugs)
            this.dataObservers.forEach(obs => {
                cb.newlyAddedEntities.forEach(newE => obs.entityAdded(EntityType.DRUG, newE));
                cb.deletedEntities.forEach(newE => obs.entityDeleted(EntityType.DRUG, newE));
                obs.entityModified(EntityType.DRUG, entity);
            });
            return cb.entity;
        });
    }

    public registerDataObserver(observer: IEntityUpdate) {
        this.dataObservers.push(observer);
    }
}