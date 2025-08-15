import { ApiModule } from "../api_module";
import { getLogger } from "../logger";

let SCHEDULER_CYCLE_SECONDS = 10;
let logger = getLogger("scheduler");

export class ScheduledRepeatedEvent {

    lastTriggerTime: number = -1;
    repeatedTriggerBlocked: boolean;

    constructor(
        public module: ApiModule,
        public name: string,
        public intervalSeconds: number,
        public callback: (callFinished: () => void) => void,
        public triggerImmediatelyAfterRegister: boolean,
    ) { }

    toLogInfo() {
        return { module: this.module ? this.module.modname() : "<no-module>", name: this.name, intervalSeconds: this.intervalSeconds };
    }

}

export class RepeatedTaskScheduler {
    scheduledRepeatedEvents: ScheduledRepeatedEvent[] = [];
    interval: NodeJS.Timeout = undefined;

    schedulerInit() {
        if (this.interval == undefined) {
            this.interval = setInterval(() => {
                logger.debug("Scheduler handling schedule cycle");
                this.handleCycle();
            }, SCHEDULER_CYCLE_SECONDS * 1000);
            logger.info("Initialized repeated task scheduler!", { cycleTimeSeconds: SCHEDULER_CYCLE_SECONDS });

            this.handleCycle();
        }
    }

    scheduleRepeatedEvent(module: ApiModule, name: string, intervalSeconds: number, callback: (callFinished: () => void) => void, triggerImmediatelyAfterRegister: boolean): ScheduledRepeatedEvent {
        let event = new ScheduledRepeatedEvent(module, name, intervalSeconds, callback, triggerImmediatelyAfterRegister);
        this.scheduledRepeatedEvents.push(event);
        logger.info("Registered new repeated scheduled event!", event.toLogInfo());
        return event;
    }

    removeScheduledRepeatedEvent(event: ScheduledRepeatedEvent) {
        if (this.scheduledRepeatedEvents.includes(event)) {
            this.scheduledRepeatedEvents = this.scheduledRepeatedEvents.filter(e => e !== event);
            logger.info("Removed repeated scheduled event!", event.toLogInfo());
        } else {
            logger.warn("Tried to remove repeated scheduled event, but not registered!", event.toLogInfo());
        }
    }

    handleCycle() {

        let currentTime = new Date().getTime() / 1000;
        for (let registration of this.scheduledRepeatedEvents) {
            let doTrigger = false;

            if (registration.lastTriggerTime == -1) {
                if (registration.triggerImmediatelyAfterRegister) {
                    doTrigger = true;
                }
                registration.lastTriggerTime = currentTime;
            }
            else if (currentTime >= registration.lastTriggerTime + registration.intervalSeconds) {
                doTrigger = true;
                registration.lastTriggerTime = currentTime;
            }

            if (doTrigger) {
                logger.debug("Scheduler triggered repeated event!", registration.toLogInfo());
                if (registration.repeatedTriggerBlocked) {
                    logger.error("Tried to trigger repeated scheduled event, but last function call did not return yet!", registration.toLogInfo());
                    continue;
                }

                registration.repeatedTriggerBlocked = true;
                let callbackFinished = () => registration.repeatedTriggerBlocked = false;
                registration.callback(callbackFinished.bind(this));
            }
        }
    }
}
