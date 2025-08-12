import * as chalk from 'chalk';
import { inspect } from 'util';
import * as winston from 'winston';

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { defaultResource, Resource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import TransportStream = require('winston-transport');
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import * as config from 'config';

// Winston
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    },
    openTelemetryLevels: { // This maps 'levels' to a level in OpenTelemtry.
        'error': SeverityNumber.ERROR,
        'warn': SeverityNumber.WARN,
        'info': SeverityNumber.INFO,
        'debug': SeverityNumber.DEBUG,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue'
    },
};

// Open Telemetry
// https://docs.kloudmate.com/send-winston-logs-to-kloudmate-using-otel-nodejs

const resource: Resource = defaultResource().merge(
    resourceFromAttributes({
        [ ATTR_SERVICE_NAME ]: config.get("logging.OPEN_TELEMETRY_SERVICE_NAME"),
        [ ATTR_SERVICE_VERSION ]: config.get("logging.OPEN_TELEMETRY_SERVICE_VERSION")
    })
);

const _username = config.get("logging.OPEN_TELEMETRY_COLLECTOR_BASICAUTH_USER");
const _password = config.get("logging.OPEN_TELEMETRY_COLLECTOR_BASICAUTH_PASS");
const logExporter = new OTLPLogExporter({
    url: config.get("logging.OPEN_TELEMETRY_COLLECTOR_URL"), // send logs to loki instance in grafana container
    headers: {
        Authorization: 'Basic ' + btoa(_username + ":" + _password),
    },
});

const logProcessor = new BatchLogRecordProcessor(logExporter)
const loggerProvider = new LoggerProvider({
    resource: resource,
    processors: [logProcessor]
});


class OtelWinstonTransporter extends TransportStream {
    constructor(opts: TransportStream.TransportStreamOptions) {
        super(opts);
    }

    public log(info: winston.LogEntry, next: () => void) {
        setImmediate(() => {
            this.emit("logged", info);
        })

        const { level, message, ...meta } = info;
        const otelLevel = customLevels.openTelemetryLevels[level];
        loggerProvider.getLogger('intranet-otel').emit({
            body: message,
            severityNumber: otelLevel,
            attributes: meta
        });

        next();
    }
}

const _baseLogger = winston.createLogger({
    levels: customLevels.levels,
    level: 'debug',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    defaultMeta: {},
    transports: [
        //
        // - Write all logs with importance level of `error` or higher to `error.log`
        //   (i.e., error, fatal, but not other levels)
        //
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        //
        // - Write all logs with importance level of `info` or higher to `combined.log`
        //   (i.e., fatal, error, warn, and info, but not trace)
        //
        new winston.transports.File({ filename: 'combined.log' }),

        // Pipe all logs to our OpenTelemetry endpoint.
        new OtelWinstonTransporter({
            
        }),

        //
        // log to the `console` with the format:
        // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
        //
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'DD.MM.YYYY HH:mm:ss' }),
                winston.format.printf(info =>
                    `${info.timestamp} ${chalk.magenta(info.service)} ${info.level}: ${info.message}` + (info.splat !== undefined ? `${info.splat}` : " ") +
                    `${inspect(Object.fromEntries(
                        Object.entries(info).filter(
                            ([key]) => !["timestamp", "level", "message", "splat", "service"].includes(key))),
                        {
                            colors: true,
                            depth: 2,
                            showHidden: false
                        })}`)
            ),
        })
    ]
});

winston.addColors(customLevels.colors);

export function getLogger(serviceName: string): winston.Logger {
    return _baseLogger.child({ service: serviceName });
}

/**
 * !!Don't export to utilities.ts. Circular import! 
 * Logger must be standalone!
 */
export function ellipseString(inputStr: string, maxLength: number) {
    if (inputStr.length > maxLength) {
        return inputStr.substring(0, maxLength) + "...";
    } else {
        return inputStr;
    }
}