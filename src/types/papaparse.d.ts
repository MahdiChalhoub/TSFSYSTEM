declare module 'papaparse' {
    interface ParseConfig {
        header?: boolean;
        preview?: number;
        complete?: (results: any) => void;
        error?: (error: any) => void;
        [key: string]: any;
    }
    function parse(file: any, config: ParseConfig): void;
    export = { parse };
    export default { parse };
}
