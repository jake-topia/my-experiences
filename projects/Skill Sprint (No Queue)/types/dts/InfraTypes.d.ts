export declare type PseudoPromise<Type> = Type;

declare global {
  export type PseudoList<Type = PseudoAny> = {
    toArray: () => Array<Type>;
    push: (...items: Type[]) => void;
    pop: () => Type;
    unshift: (...items: Type[]) => void;
    shift: () => Type;
    [index: number]: Type;
    length: number;
  };
  export type PseudoMap<Type = PseudoAny> = {
    toObject: () => Record<string, Type>;
    entries: () => [string, Type][];
    values: () => Type[];
    keys: () => string[];
    delete: (key: string) => void;

    [key: string | number]: Type;
  };

  export type PseudoComponent<Class extends ComponentScript = ComponentScript> = {
    [key: string | number]: any;
  } & Class;
  export type PseudoSystem<Class extends SystemScript = SystemScript> = {
    [key: string | number]: any;
  } & Class;

  export type PseudoAny = any;
}
