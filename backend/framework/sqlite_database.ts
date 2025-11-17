import * as fs from 'fs';
import * as sqlite from 'sqlite3';
import { getLogger } from '../logger';

export type SqlUpdate = {
	update: string,
	params: any[]
};

export class SQLiteDB {

	logger = getLogger("sqlite");

	database: sqlite.Database = undefined;
	moduleName: string = "";
	
	sqliteInit(moduleName: string) {
		const databasePath = __dirname + "/databases/" + moduleName + ".db";

		this.moduleName = moduleName;
		this.logger.info("Opening sqlite database", {dbname: moduleName, db: databasePath});
		this.database = new sqlite.Database(databasePath, sqlite.OPEN_CREATE | sqlite.OPEN_READWRITE);
	}
	
	sqlUpdate(update: SqlUpdate) {
		if (this.database == undefined) {
			this.logger.error("Can't perform operation on sqlite database as it is not initialized!", { dbname: this.moduleName, op: "update", parameters: update.params });
			return;
		}
		
		return new Promise<void>((resolve, reject) => {
			try {
				if (update.params.length == 0) {
					this.database.exec(update.update, (err) => {
						if (err) reject(err);
						resolve();
					});
				} else {
					this.database.run(update.update, update.params, (err) => {
						if (err) reject(err);
						resolve();
					});
				}
			} catch(e) {
				reject("error: " + e);
			}
		});
	}
	
	sqlFetchAll(query, params): Promise<unknown[]> {
		if (this.database == undefined) {
			this.logger.error("Can't perform operation on sqlite database as it is not initialized!", { dbname: this.moduleName, op: "query-all", query: query, params: params });
			return Promise.reject();
		}
		
		return new Promise<unknown[]>((resolve, reject) => {
			try {
				this.database.all(query, params, (err, rows) => {
					if (err) reject(err);
					resolve(rows);
				});
			} catch(e) {
				reject("error: " + e);
			}
		});
	};
	
	sqlFetchFirst(query, params): Promise<unknown> {
		if (this.database == undefined) {
			this.logger.error("Can't perform operation on sqlite database as it is not initialized!", { dbname: this.moduleName, op: "query-first", query: query, params: params });
			return Promise.reject();
		}
		
		return new Promise<unknown>((resolve, reject) => {
			try {
				this.database.get(query, params, (err, row) => {
					if (err) reject(err);
					resolve(row);
				});
			} catch(e) {
				reject("error: " + e);
			}
		});
	};
}