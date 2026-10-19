import { getRequest } from "@tanstack/react-start/server";

const statuses = new WeakMap<Request, number>();

export const markResponseStatus = (code: number): void => {
  statuses.set(getRequest(), code);
};

export const markedResponseStatus = (request: Request): number | undefined => statuses.get(request);
