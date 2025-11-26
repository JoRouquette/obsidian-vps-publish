export interface CommandHandler<C, R = void> {
  handle(command: C): Promise<R>;
}
