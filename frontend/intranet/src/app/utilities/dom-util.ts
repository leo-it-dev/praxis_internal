export function findThisOrParentWithProperty(domElement: HTMLElement, propertyList: string[]): HTMLElement | undefined {
    let el = domElement;
    while(el.parentElement != null) {
        let style = getComputedStyle(el);
        
        let propertiesPresent = propertyList.filter(p => !["none", ""].includes(style.getPropertyValue(p)));
        if (propertiesPresent.length > 0) {
            return el;
        }
        el = el.parentElement;
    }
    return undefined;
}

export function findThisOrParentTag(domElement: HTMLElement, tagName: string): HTMLElement | undefined {
    let el = domElement;
    while(el.parentElement != null) {
        if (el.tagName == tagName) {
            return el;
        }
        el = el.parentElement;
    }
    return undefined;
}

export function findThisOrParentWithAttribute(domElement: HTMLElement, attributeName: string): HTMLElement | undefined {
    let el = domElement;
    while(el.parentElement != null) {
        if (el.hasAttribute(attributeName)) {
            return el;
        }
        el = el.parentElement;
    }
    return undefined;
}

export function findThisOrParentWithClass(domElement: HTMLElement, className: string): HTMLElement | undefined {
    let el = domElement;
    while(el.parentElement != null) {
        if (el.classList.contains(className)) {
            return el;
        }
        el = el.parentElement;
    }
    return undefined;
}