import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  ...(process.env.NODE_ENV !== 'production' && !isTest && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
  }),
});

export default logger;
