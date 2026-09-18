export const MARVIN_API_ORIGIN = "https://serv.amazingmarvin.com/*";

export const TASK_UNROLLER_DATA_TYPES = [
  "authenticationInfo",
  "websiteContent",
] as const;

export interface TaskUnrollerPermissionDescriptor {
  origins: string[];
  data_collection?: string[];
}

export function taskUnrollerPermissions(browserName: string): TaskUnrollerPermissionDescriptor {
  const descriptor: TaskUnrollerPermissionDescriptor = {
    origins: [MARVIN_API_ORIGIN],
  };

  if (browserName === "firefox") {
    descriptor.data_collection = [...TASK_UNROLLER_DATA_TYPES];
  }

  return descriptor;
}
