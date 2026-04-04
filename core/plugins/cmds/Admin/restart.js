export const config = {
    name: "restart",
    alias: ["rs"],
    role: 3,
    info: "Restart bot",
    guide: "restart",
    cd: 2,
    prefix: true
};

export function call(context) {
    const { reply, react } = context;
    return reply("🔄 Restarting...", () => process.exit(1));
}