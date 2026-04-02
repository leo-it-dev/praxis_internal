import { getRepeatedScheduler } from "../..";
import { ApiInterfaceDropNewsIn, ApiInterfaceNewsOut, ApiInterfacePostNewsIn, News } from "../../../api_common/api_news";
import { ApiInterfaceEmptyIn, ApiInterfaceEmptyOut, ApiModuleResponse } from "../../../api_common/backend_call";
import { UserPermission } from "../../../api_common/permission_types";
import { ApiModule } from "../../api_module";
import { SqlUpdate } from "../../framework/sqlite_database";
import * as config from 'config';

export class ApiModuleNews extends ApiModule {

    newsBackendData: News[] = [];

    modname(): string {
        return "news";
    }

    async initialize() {
        getRepeatedScheduler().scheduleRepeatedEvent(this, "update-news", (config.get('generic.NEWS_UPDATE_INTERVAL_MINUTES') as number) * 60, (finish) => {this.updateNews.bind(this)(); finish()}, true);
    }

    loginRequired(): boolean {
        return true;
    }

    permissionRequired(): UserPermission | undefined {
        return UserPermission.NEWS;
    }

    reorderNews() {
        this.newsBackendData = this.newsBackendData.sort((a, b) => a.created.getTime() > b.created.getTime() ? -1 : 1);
    }

    protected sqliteTableCreate(): SqlUpdate | undefined {
        return {
            params: [],
            update: "CREATE TABLE IF NOT EXISTS news (\
               ID INTEGER PRIMARY KEY AUTOINCREMENT, \
               text TEXT NOT NULL,\
               created DATETIME NOT NULL,\
               user VARCHAR(64) NOT NULL,\
               userSID VARCHAR(64) NOT NULL\
            \);"
        }
    }

    async sqliteReadAllNews(): Promise<News[]> {
        return new Promise<News[]>(async (res, rej) => {
            try {
                let rows = await this.sqlite().sqlFetchAll("SELECT * FROM news;", []);
                let news: News[] = rows.map(row => {
                    return {
                        created: new Date(row["created"]),
                        text: row["text"],
                        creator: row["user"],
                        id: row["ID"],
                        creatorSID: row["userSID"]
                    }
                });
                res(news);
            } catch (err) {
                rej(err);
            }
        });
    }

    async sqlitePostNews(news: News): Promise<number> {
        return new Promise<number>(async (res, rej) => {
            try {
                await this.sqlite().sqlUpdate({
                    params: [news.text, news.created, news.creator, news.creatorSID],
                    update: "INSERT INTO news(text, created, user, userSID) VALUES (?, ?, ?, ?)"
                });
                let row = await this.sqlite().sqlFetchFirst("SELECT last_insert_rowid()", []);
                res(row["last_insert_rowid()"]);
            } catch (err) {
                rej(err);
            }
        });
    }

    async sqliteDropNews(newsID: number) {
        return new Promise<void>(async (res, rej) => {
            try {
                await this.sqlite().sqlUpdate({
                    params: [newsID],
                    update: "DELETE FROM news WHERE ID=?;"
                });
                res();
            } catch (err) {
                rej(err);
            }
        });
    }

    registerEndpoints(): void {
        this.get<ApiInterfaceEmptyIn, ApiInterfaceNewsOut>("news", async (req, user) => {
            let result: ApiModuleResponse<ApiInterfaceNewsOut>;
            result = {
                statusCode: 200, responseObject: {
                    simpleNews: this.newsBackendData
                }, error: undefined
            };
            return result;
        });

        this.postJson<ApiInterfacePostNewsIn, ApiInterfaceEmptyOut>("postnews", async (req, user) => {
            try {
                if (!user.userPermissions.userHasPermission(UserPermission.POST_NEWS)) {
                    return {
                        error: "User does not have permission to post new messages!",
                        responseObject: {},
                        statusCode: 400
                    };
                }

                let result: ApiModuleResponse<ApiInterfaceEmptyOut>;
                let news: News = {
                    text: req.body.message,
                    created: new Date(),
                    creator: user.userTokenData.given_name + " " + user.userTokenData.family_name,
                    creatorSID: user.userTokenData.sid,
                    id: -1,
                };
                let id = await this.sqlitePostNews(news);
                news.id = id;
                this.newsBackendData.push(news);
                this.reorderNews();

                result = {
                    statusCode: 200, responseObject: {
                    }, error: undefined
                };
                return result;
            } catch (err) {
                let result = {
                    statusCode: 500, responseObject: {
                    }, error: "internal error!"
                };
                return result;
            }
        });

        this.postJson<ApiInterfaceDropNewsIn, ApiInterfaceEmptyOut>("dropnews", async (req, user) => {
            try {
                if (!user.userPermissions.userHasPermission(UserPermission.POST_NEWS)) {
                    return {
                        error: "User does not have permission to post or delete messages!",
                        responseObject: {},
                        statusCode: 400
                    };
                }

                let news: News = this.newsBackendData.find(n => n.id == req.body.newsID);

                if (!news) {
                    return {
                        error: "News entry with given ID not found!",
                        responseObject: {},
                        statusCode: 400
                    };
                }

                if (news.creatorSID.toLowerCase() != user.userTokenData.sid.toLowerCase()) {
                    return {
                        error: "User trying to delete the message is not it's creator!",
                        responseObject: {},
                        statusCode: 400
                    };
                }

                if (news.id < 0) {
                    return {
                        error: "User sent invalid request!",
                        responseObject: {},
                        statusCode: 400
                    };
                }

                let result: ApiModuleResponse<ApiInterfaceEmptyOut>;
                await this.sqliteDropNews(req.body.newsID);
                this.newsBackendData = this.newsBackendData.filter(n => n.id != req.body.newsID);
                this.reorderNews();

                result = {
                    statusCode: 200, responseObject: {
                    }, error: undefined
                };
                return result;
            } catch (err) {
                let result = {
                    statusCode: 500, responseObject: {
                    }, error: "internal error!"
                };
                return result;
            }
        });
    }

    async updateNews() {
        try {
            this.newsBackendData = await this.sqliteReadAllNews();
            this.reorderNews();
            this.logger().info("Successfully read news from database!", { newsCount: this.newsBackendData.length });
        } catch (err) {
            this.logger().error("Error reading news from database!", { error: err });
        }
    }
}