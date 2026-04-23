import {initializeApp} from './appInitializer.js';

type AppHandler<TArgs extends unknown[], TResult> = (...args: TArgs) => Promise<TResult>;

export function withAppInitialization<TArgs extends unknown[], TResult>(
    handler: AppHandler<TArgs, TResult>,
): AppHandler<TArgs, TResult> {
    return async (...args: TArgs): Promise<TResult> => {
        await initializeApp();
        return handler(...args);
    };
}
