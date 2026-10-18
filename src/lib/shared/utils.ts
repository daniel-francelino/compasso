import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type ValueOf<T> = T[keyof T];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type NestedValueOf<T> = T extends string
  ? T
  : { [K in keyof T]: NestedValueOf<T[K]> }[keyof T];
