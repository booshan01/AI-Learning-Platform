import { Router, type IRouter } from "express";
import healthRouter from "./health";
import learningRouter from "./learning";
import personalProfileRouter from "./personal-profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(learningRouter);
router.use(personalProfileRouter);

export default router;
