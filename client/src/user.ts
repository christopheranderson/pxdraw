import { config, AppConfig } from "./config";
import { Main } from "./main";

export interface IUser {
    id: string;
    lastUpdate: Date;
    isAdmin: boolean;
}

export class User implements IUser {
    public id: string;
    public lastUpdate: Date;
    public isAdmin: boolean;

    public constructor(user: IUser)
    {
        this.id = user.id;
        this.lastUpdate = user.lastUpdate;
        this.isAdmin = user.isAdmin;
    }

    public static async getUser(userEndpoint: string): Promise<User> {
        return new Promise<User>((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: userEndpoint,
                xhrFields: {
                    withCredentials: true
                },
                beforeSend: function (request) {
                    if(config.isLocal) {
                        // locally, we spoof the header
                        request.setRequestHeader('x-ms-client-principal-id', Main.LOCALHOST_CLIENT_PRINCIPAL_ID);
                        request.setRequestHeader('x-ms-client-principal-idp', Main.LOCALHOST_CLIENT_PRINCIPAL_IDP);
                    }
                },
                success: (data: IUser, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                    resolve(new User(data));
                },
                error: (jqXHR: JQuery.jqXHR, textStatus: JQuery.Ajax.ErrorTextStatus, errorThrown: string): void => {
                    console.error(`Failed to fetch user:${errorThrown}`);
                    reject(errorThrown);
                }
            });
        });
    }
}