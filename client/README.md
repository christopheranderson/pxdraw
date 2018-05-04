This is the client app for build demo.

## Environment variables

- `PXDRAW_METADATA_ENDPOINT`: sets the metadata endpoint that this app needs to talk to (defaults to localhost)
- `PXDRAW_APPINSIGHTS_KEY`: sets the app insights key you want to use
- `PXDRAW_REGION_LABEL`: sets the region label in the page title (defaults to "") (this is only used for the demo environments to show which region the site is in)
- `PXDRAW_ENABLE_TRENDING_TWEETS`: Enables display of trending tweets: set to true to enable (disabled in demo environment)

## Build the client

1) Install latest nodejs
https://nodejs.org/en/download/
2) Install dependencies

    ```bash
    npm i
    ```

3) (Optional for local) Set environment variables

3) Compile typescript source

    ```bash
    npm run build
    ```

## Run the client

1. Build the client (see above)

2. Serve the files (for debug only)

    ```bash
    npm run
    ```
