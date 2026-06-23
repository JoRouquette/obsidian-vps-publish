export interface CommandHandler<C, R = void> {
    handle(command: C): Promise<R>;
}
//# sourceMappingURL=command-handler.d.ts.map