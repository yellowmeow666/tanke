/** 每步推进的时间（秒）。 */
export const STEP_SECONDS = 1 / 60;
/** 每格像素。 */
export const TILE_SIZE = 32;
/** 坦克边长（像素），与一格相同。 */
export const TANK_SIZE = 32;
/** 子弹边长（像素）。 */
export const BULLET_SIZE = 4;
/** 每步移动像素。 */
export const PLAYER_SPEED = 2;
export const ENEMY_SPEED = 1;
export const BULLET_SPEED = 4;
/** random 敌人开火冷却范围（步，含两端）。 */
export const ENEMY_FIRE_COOLDOWN_MIN = 45;
export const ENEMY_FIRE_COOLDOWN_MAX = 105;
/** random 敌人开局首次开火前的等待范围（步）。 */
export const ENEMY_FIRST_FIRE_MIN = 30;
export const ENEMY_FIRST_FIRE_MAX = 90;
/** random 敌人主动换方向的间隔范围（步）。 */
export const ENEMY_TURN_MIN = 60;
export const ENEMY_TURN_MAX = 180;
