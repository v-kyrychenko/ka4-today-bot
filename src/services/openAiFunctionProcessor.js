import {log} from "../utils/logger.js";

/**
 * Processor for OpenAI function calls (tool calling).
 */
const openAiFunctionProcessor = {

    /**
     * Generates a list of available exercises for a given user.
     *
     * @param {Object} args - Arguments passed from the Assistant API.
     * @param {string} args.chatId - The unique identifier of the chat/user.
     * @returns {Promise<Object>} - The output object to be sent back to the Assistant API.
     */
    generateDailyWorkout: async ({chatId}) => {
        log(`GenerateDailyWorkout for ${chatId}`)
        //TODO read from DB
        return {
            "variationId": Date.now(),
            "level": "beginner",
            "primaryMuscles": [
                "chest"
            ],
            "secondaryMuscles": [
                "biceps"
            ],
            "category": "strength",
            "history": [],
            "plan": {
                "chest": 3,
                "biceps": 2
            }
        }
    }
};

export default openAiFunctionProcessor;
