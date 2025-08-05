import * as fs from 'fs';
import * as config from 'config';
import { getLogger } from './logger';

const BACKUP_FILE_POSTFIX = ".back";
const patchEntryRegex = /{\+([^}]+)}/g; // {+ABC} -> development.json/movetaOdbcConnection.ABC

export function performPatches(patches: {configurationBase: string, patchPaths: string[]}[]) {
    let logger = getLogger('ext-config-patcher');

    logger.info("Patching external configuration files...");

    for (let entry of patches) {
        let configurationBase = config.get(entry.configurationBase);
        let paths = entry.patchPaths;

        logger.info("Patching following entry count", {entries: Object.keys(configurationBase).length, paths: paths});

        for (let path of paths) {
            let backupFilePath = path + BACKUP_FILE_POSTFIX;
            let sublogger = logger.child({file: path});
            sublogger.info("Starting file patch");
            // at least one placeholder is found in file, let's back it up before we overwrite the placeholders.
            let containsPlaceholders = fs.readFileSync(path, 'utf-8').match(patchEntryRegex) !== null;
            let backupExists = fs.existsSync(backupFilePath);

            if (containsPlaceholders) {
                if (!backupExists) {
                    fs.copyFileSync(path, backupFilePath);
                    sublogger.info(" - Backup");
                } else {
                    sublogger.info("   - Still contains entries to patch, but using backup as template!");
                }
            } else {
                sublogger.info("   - No placeholders to patch!");
            }

            backupExists = fs.existsSync(backupFilePath);
            if (backupExists) {
                let backupContent = fs.readFileSync(backupFilePath, 'utf-8');
                let patchedContent = backupContent.replace(patchEntryRegex, (match, key) => {
                    return configurationBase[key] || match;
                });
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                    sublogger.info("   - Delete");
                }
                fs.writeFileSync(path, patchedContent);
                sublogger.info("   - Patch");
            } else {
                sublogger.info("   - No backup to use as template!");
            }
        }
    }

    logger.info("Done patching external configuration files!");
}