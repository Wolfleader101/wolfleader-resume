import { v4 } from "uuid";
import { create } from "zustand";

type ComponentType<T> = new (...args: unknown[]) => T;

interface Entity {
  id: string;
}

interface EntityList {
  entities: Array<Entity>;
  components: Map<ComponentType<unknown>, Map<string, unknown>>;

  createEntity(): Entity;
  getEntity(entityId: string): Entity | undefined;
  removeEntity(entityOrId: string | Entity): void;
  hasEntity(entityOrId: string | Entity): boolean;
  clearEntities(): void;

  addComponent<T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
    component: T,
  ): void;
  getComponent<T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
  ): T | undefined;
  removeComponent<T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
  ): void;
  hasComponent<T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
  ): boolean;
  hasComponents<T>(
    componentTypes: ComponentType<T>[],
    entityOrId: string | Entity,
  ): boolean;
  clearComponents(): void;
}

const useECS = create<EntityList>((set, get) => ({
  entities: new Array<Entity>(),
  components: new Map(),
  createEntity: () => {
    const entity = { id: v4() };
    set((state) => ({ ...state, entities: [...state.entities, entity] }));
    return entity;
  },
  getEntity: (entityId: string) => {
    return get().entities.find((e) => e.id === entityId);
  },
  removeEntity: (entityOrId: string | Entity) => {
    const entityId =
      typeof entityOrId === "string" ? entityOrId : entityOrId.id;

    set((state) => {
      const newEntities = state.entities.filter((e) => e.id !== entityId);

      const newComponents = new Map(state.components);
      newComponents.forEach((componentMap) => {
        componentMap.delete(entityId);
      });

      return { ...state, entities: newEntities, components: newComponents };
    });
  },
  hasEntity: (entityOrId: string | Entity) => {
    const entityId =
      typeof entityOrId === "string" ? entityOrId : entityOrId.id;
    return get().entities.some((e) => e.id === entityId);
  },
  clearEntities: () => {
    set((state) => ({ ...state, entities: [] }));
    get().clearComponents();
  },

  addComponent: (componentType, entityOrId: string | Entity, component) =>
    set((state) => {
      const entityId =
        typeof entityOrId === "string" ? entityOrId : entityOrId.id;
      const newComponents = new Map(state.components);
      const componentsOfType =
        newComponents.get(componentType) ?? new Map<string, unknown>();
      componentsOfType.set(entityId, component);
      newComponents.set(componentType, componentsOfType);

      return { ...state, components: newComponents };
    }),
  getComponent: <T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
  ) => {
    const entityId =
      typeof entityOrId === "string" ? entityOrId : entityOrId.id;
    const componentMap = get().components.get(componentType);
    return componentMap?.get(entityId) as T | undefined;
  },

  removeComponent: <T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
  ) => {
    const entityId =
      typeof entityOrId === "string" ? entityOrId : entityOrId.id;

    set((state) => {
      const newComponents = new Map(state.components);
      const componentsOfType = newComponents.get(componentType);
      if (componentsOfType) {
        componentsOfType.delete(entityId);
        newComponents.set(componentType, componentsOfType);
      }
      return { ...state, components: newComponents };
    });
  },
  hasComponent: <T>(
    componentType: ComponentType<T>,
    entityOrId: string | Entity,
  ) => {
    const entityId =
      typeof entityOrId === "string" ? entityOrId : entityOrId.id;

    const componentMap = get().components.get(componentType);
    return componentMap?.has(entityId) ?? false;
  },
  hasComponents: <T>(
    componentTypes: ComponentType<T>[],
    entityOrId: string | Entity,
  ) => {
    const entityId =
      typeof entityOrId === "string" ? entityOrId : entityOrId.id;

    return componentTypes.every((componentType) => {
      const componentMap = get().components.get(componentType);
      return componentMap?.has(entityId) ?? false;
    });
  },
  clearComponents: () => {
    set((state) => ({ ...state, components: new Map() }));
  },
}));

export default useECS;
