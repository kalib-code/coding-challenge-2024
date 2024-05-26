import { SSTConfig } from "sst";
import { API } from "./stacks/MyStack";

export default {
    config(_input) {
        return {
            name: "code-challenge-1",
            region: "ap-southeast-2",
        };
    },
    stacks(app) {
        app.stack(API);
    },
} satisfies SSTConfig;
