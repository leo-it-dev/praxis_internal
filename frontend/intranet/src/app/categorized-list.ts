export class CategorizedItem<T> {
    item: T;
    category: string;

    constructor(item: T, category: string) {
        this.item = item;
        this.category = category;
    }
}

export class CategorizedList<T> extends Array<CategorizedItem<T>> {

    counter: number = 0;

    constructor(...items: CategorizedItem<T>[]) {
        super(...items);
    }


    init(...initVals: {category: string, items: T[]}[]) {
        for(const e of initVals.flatMap(val => val.items.map(i => new CategorizedItem(i, val.category)))) {
            this.push(e);
        }
    }

    add(items: T[], category: string) {
        for(const i of items) {
            this.push({
                category: category,
                item: i
            });
        }
    }
}