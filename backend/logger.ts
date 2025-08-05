import * as winston from 'winston';
import * as chalk from 'chalk';
import { inspect } from 'util';

const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue'
    }
};
export class Logger {

    _baseLogger = winston.createLogger({
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
                        `${
                            inspect(Object.fromEntries(
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
};

const _logger = new Logger();
winston.addColors(customLevels.colors);

export function getLogger(serviceName: string): winston.Logger {
    return _logger._baseLogger.child({ service: serviceName });
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