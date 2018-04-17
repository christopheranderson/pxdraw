const config: AppConfig = {
    metadataEndpoint: "http://localhost:7071/api/metadata",
    isLocal: true
}

if (window && window.location && window.location.hostname) {
    if (!window.location.hostname.startsWith("localhost")) {
        const info = parseHostnameByConvention(window.location.hostname);
        config.metadataEndpoint = getMetadataEndpoint(info);
        // TODO: should set isLocal = false
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

export function getMetadataEndpoint(info: hostinfo) {
    return `https://${info.base}-api${info.stage ? "-" + info.stage : ""}.azurewebsites.net/api/metadata`;
}

export interface hostinfo {
    base: string;
    stage?: string;
}

export interface AppConfig {
    metadataEndpoint: string;
    isLocal: true;
}

export { config };