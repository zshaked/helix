let counter = 0;

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const seq = (counter++).toString(36);
  return `${timestamp}-${random}-${seq}`;
}

export function generateGraphId(): string {
  return `graph_${generateId()}`;
}
