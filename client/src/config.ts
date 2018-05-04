declare var METADATA_ENDPOINT: string;
declare var ENABLE_TRENDING_TWEETS: boolean;
declare var AUTHREQUIRED: boolean;

const config: AppConfig = {
    metadataEndpoint: METADATA_ENDPOINT,
    isLocal: true,
    isTrendingTweetsEnabled: ENABLE_TRENDING_TWEETS,
    isAuthRequired: AUTHREQUIRED
}

if (window && window.location && window.location.hostname) {
    if (!window.location.hostname.startsWith("localhost")) {
        const info = parseHostnameByConvention(window.location.hostname);
        config.isLocal = false
    }
}

export function parseHostnameByConvention(hostname: string): hostinfo {
    const stages = ["dev"];

    let fullname = hostname.replace(".azurewebsites.net", "").replace("www", "");
    let stage = stages.find((v) => fullname.endsWith(`-${v}`));
    if (stage) {
        fullname = fullname.replace(`-${stage}`, "");
    }
    return {
        base: fullname,
        stage
    }
}

// export function getMetadataEndpoint(info: hostinfo) {
//     return `https://${info.base}-api${info.stage ? "-" + info.stage : ""}.azurewebsites.net/api/metadata`;
// }

export interface hostinfo {
    base: string;
    stage?: string;
}

export interface AppConfig {
    metadataEndpoint: string;
    isLocal: boolean;
    isTrendingTweetsEnabled: boolean;
    isAuthRequired: boolean;
}

export { config };