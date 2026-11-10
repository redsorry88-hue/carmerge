'use strict';
/* Car Merge Pro — игровой сервер. Без зависимостей, нужен Node.js 18+.
   Запуск: node server.js   (порт: PORT, папка данных: DATA_DIR) */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'data.json');
const GARAGE = 12, MAX = 30, BIG = 1e40;
const INCOME_MULT = 0.5; // должен совпадать с INCOME_MULT в index.html
const SESSION_TTL = 60 * 24 * 3600 * 1000;
const DAILY_COINS = [2, 3, 4, 5, 6, 8, 15];          // награда по дням серии (7 дней, дальше по кругу)
const WEEK_PRIZES = [30, 20, 10];                    // коины за 1/2/3 место недели (по числу слияний)
const Q_IDS = ['merge', 'buy', 'upg', 'all'];        // ежедневные задания
const A_IDS = ['m100', 'm1000', 'l10', 'l20', 'l30', 'b500', 'boost10', 'top1m', 'inc10', 'auto']; // достижения
const dayStr = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const weekStart = (t = Date.now()) => { const d = new Date(t), k = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - k); };
const weekId = (t = Date.now()) => new Date(weekStart(t)).toISOString().slice(0, 10);
const ICON192 = Buffer.from('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', 'base64'), ICON512 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAMAAADDpiTIAAAAwFBMVEU39u4Z9/8Z8/8Z8/4Z8PwO+v/Kpb//XOL/XOD/XLr7XN3/Qdj/LtL/LtD/Ls/iP8RhFF8yDD4xCz0vC0AvCzwuC0AuCz8uCzwtCz8sCz4sCzsrCz0qCz0qCzopCzsnCzkpCjknCjkmCjklCjcjCjYhCjYMChwhCTQfCTQeCTQdCTIeBy8bCTMbCTEaCTEaCC8ZCTEZCDAYCDEYCC8XCDAXCC8YBCsWCDAWCC8VCC8UCC4WBCoTCC4TCC0SCC0IBBO4+VDZAAAjH0lEQVR42u2de3vbuHLG4UsSr2xJpMqtWq5pS6FXSqLN8enZ1r24XX//b1VSV15wxwwIkvM++88+SSgQ7w8zAxAk2F+kUYtRFxAAJAKARACQCAASAUAiAEgEAIkAIBEAJAKARACQCAASAUAiAEgEAGl4APwfadQiAAgAEgFAIgBIBACJACARACQCgDQiAP6XNGoRAAQAiQAgEQAkAoBEAJAIANK4APgf0qhFABAAJAKARACQCAASAUAiAEgEAIkAIBEAJAKARACQCAASAUAiAEgEAGmAAPw3adQiAAgAEgFAIgBIBACJACARACQCgEQAkAgAEgFAIgBIBACJACARACQCgDRAAP6LNGoRAAQAiQAgEQAkAoBEAJAIABIBQBoRAP9JGrUIAAKARACQCAASATA+HQphAmAkRpuKABij62Njgf374PQfiBpebzFyftwcMLJ+3Bgwsn7cGDDyftwUMDJ/3BAw8n7cFDAyf9wQMHJ/3AwwMn/cEDAyf9wQMHJ/3Awwcn/cDDAyf9wQMHJ/3Awwcn/cDDByf9wMsH8EpT///PMfg1ZwN8j+QRq1CAACgEQAkAgAEgFAIgBIBACJABi0/pSKABid5SPHgZHx4waBkfHjBoGR9+OmgJH148aAkffjpoCR+eOGgP0badQiAAgAEgFAIgDGo1eJCIDRWT52HBgZP24QGDk/bg4YWT9uDNjfB6O/edRweo2R9+OmgI3Y/J9njRgCNhbvfxpqLBSwgbv/01kDZ4AN1Pyf4BooBGxw7v9E1eAYYINy/6cXDYoBNhT3f3rWUBhgf+uP7N36YSXswjEIsWHb/wNAw0aADdT9H+AaKANsaO7/QNbQGGADcv+HNw2IATYM9390oGEwwPpvv65h3wwEDAEBgGU/sO9WJPQbAdZf992N3x7lDkJ/GWA9td/c+q2RzDHoKQKsj/abeL91lAkFfUSA9c5+Xe+3oNKloHcIsH7Zr2X+Fk1aEPQLAdYj+zXM33qQBgQ9QoD1xX6l+VuvUkLQFwTYMOy3MvHlLFcGeowAC99+hflmVpvIjAJjCAIB4A8/gniaq2u6wtdcIicknCJCS56MYcOy39J3IxKGhQALz3+p/cbm546yhgAAgaEA4Gy/lfs5qMAYCI0AFpb/stCva77Iw/W6+E9H5d/U40CdCxwRGAAAQPbbe8+3fdUSHwV7CnqCAAvHf2P7Fe7XnV8ZSs6BFgMwCPQbAAj7ddw/GfP8fHYwEymVSPiPzpd9fuZDIGXACYE+A+Dgv3Twt70vnH9+3m53h8+47FB0vPZ2mz+fOVAyIAwDgRDA+md/e+g/r9bbt/fXXRxHHhTHxY+97fLVczsQ9A8BFoD/JvZzxv5q+/q2LayfzyeTyRd8TSbzeYFB/va21YwD7gj0EQBX++Xunwq9Vf76Vpo/ObuDrbvDD90VFMSvb/lq3S4JDIqBzglggfovtf9c52fbt5di5Jd+7L3xpBMHk3mUvW1XnLJQiEBwBLBu/de2/4Vr/3sczQ/D/s6/9vmmCANvu2yd64QBNwT6BYCl/6Loz5vsr/Ii9k/KsX/XmUoGJvP4bXtBQBYGBHmgUwJYSOHfxP5sl5f2d+j+kYG7L5MiCjyvcn0EQkoDLLThr+H+er3O8rcy+Hdu/xmBbZEH1jphILQgYAAAwPtyRo/6uIu8hzXddLcMxf49AkUtEL9lhxXk3CAUGD8w1PWgSwDA/a+6f1zSL4f/XTD+7xGYRLvVEYE1BwHPBGAAgOq/if3ZahcFNPzPeWD+kqcrcwQ6JoB16r/Kfs7gX6X5NrDhfwoC83iXXp4lthmAeVQETADz5b9B9OfZf34al27j+Zfw7D8QEO2WlefJagSsHhjDEgALAMTw51X9l8f06Uuo/h8LgeWKh4BiUoBBACwA3vyX2x+0/20CdBDomgDWkf+60b9qf5alq5D9PxCwTSrbR3gIaAcBLwRALQT90F8n+F5IPvwvhd+6tr0nzfKg/d8TEL8sa5uI1peCUB4Eyn7Rn+f/CGsl0Mp/Q/uzdLkN3P/DXGCVZlYIdEIA68B/7vBvJH+O/emimP8H7v+egG2SChEQlAKXIOCbAObX/+8q/8X2p4tt9EW+FqOzXqP7mM/6jydfol2cqhFwTQNABEAA8EMbAFH4b0f/lv3pMvNVALr+yJfoZZHyEMjVCOgTcOj3MACA9f8y/Kv7uJfxTur/5PNnptbnz1ruqi4mvUyRBLLlMm0hoBcEjAgIAwAo/6X2L+OtpACYfGY3n/R0yz4r3Wfqy1wzMQP7JKCFQAAEsM79bw3/+szvYP8ySVJxACgdu76+vVbr9vrq0ycmjQKfb8uLKVWgJCZpEuUFAVUEmnmAGwS6IID58v+73P+G/dV3eEr3F7IA8Lkw49pApXWia03Ypyu9i91eCUkqkkAeL5LkiEDaiALiIHAh4LsvAth3uSQ/bvBh7W/SvZ780u9sfmH/Il7GE9EUgH26NlNhnYiAwn99lm4lBBQhYLEo216NA/xy0OSFMgszFAazLv2XzPwuob+wfyELAMxs+B+DwGd3/yUEFCFgFZft3hNwQUAwJ+ySAGbr/x9A/quG/97+OBEGgM82/hcETCBgKgiQhIALAsZBwJiAP2wJsAQA2P/K69s8++P4RRQAJlc311YA8MauOUy3olBSVgExD4EVtxxEJcAeAJAEYOR/Pfqf7C8kmgIwuwDAdW5ye2V8natbURkQpfEFAX4egCXALgQw7AAge+6bi/w/J/+j/SthAPh0bamWcxOrbHIrqCeLHLA9Nr5WCuinAVMCLEMA69x/tf1xnEMHgOvrm1YImLBPULnk8FTwLCUCHRJgBwCy/0kt+pcSlIB2np2cg4kmnyaiJwJplYBLKYBHADAAAAHAwH/x8N9nAEGivbp2AGDingGkOSCPlUEAlACrEGABAKz/guEfV7USZYDP9gGgWQTAAzCv3UMsDAI+CLABwD0BQPkvmgPYeiZYDLJMJ6KlgPKdUe8EmIcAhhcAJP5z0r/E/vIt8LveATCpFgFcBHiFgBsBFiGAoQUAff8Vwz9OBCVA6ADMV3GsEwQgCTAOAQytAjT1/7T0E7ckWgUIHgDOvVSWhYwIQKsDGW4CkPlfD/+pYPiXnTbvIwB3zSqwFgTSZhpAJwAKAKcEwB//svAvWwcOHYBmFSgpBGQxACgJmAHgGgDU/rfLP5H9ohowdADuvkT8+zmmAe0YYESAaQhQbQgR4sH/k286r/xUH/2d1n6E7g8QgCMD51WhFW9CKOTgm6knThtChD/23QaA1qPfVDn6DwDc9RGAiQSAahRIW4+IbQD47hEA2wDQGv96/sfCheDQAZgvjAnIrQmwDAEMMgBY+H8M/zL/hwnA4QHRKQ0AEeAHAGUAAPa/xwBIb8ueAMgQwNATgIb/cTxGAOqloBYBCEnABoDvP8z9f7H3f7gAyAh4MSfgx3cfALgkgFb9l+j4P2AAjqVgKiEAOwnAAaBOAJWnfyb+DxkAHgHSyaA8BHgAAM5/zfjfbwCi2CILeCUAGgB4/6NhA2BLQIcAGAeA5vL/af1Hc/wPHIAjAY0sIH5zTBUCcAFwCQCW/vcbADcCPIQABhoAtCcABv73HAAzArSmAqAhgIEEAGUCaBUAmvk/6j8AUWRDQL0M0E8CxiGAeQ4Alaf/mv73HwAtApIWAX5CAEMLAFD+DwAAaAIgQwD7ppTI7otEB7w2vvd72vyZ6PhfOaq1/wBoMHDZKFbZJ5aLdwpWQTDxqikIAIQH/PL9X5r5X+hLbzeERGYELPkEvGgT4AMA0wBQ2f4p3fwt9r/HW8IifQJqG8Y1totrhQAIAOACgN7+n7b//QWgeey4DgFpjQD0EMDwA4B5AdA8sL2328JNCRCWAXghgKEFAEkCMPR/MABEBmWAbRIwDQHMWwDQLgCiYQBQniFlSAC3DEAOASgAuCSAiKeevhzKuxXgJNA9AKIz/7gJIFkk5uO/rAL7WAR+iYwBKAlYJNwkoDqBFAsA8wDwIpsBLGzGf5kD+jgLENyM7lOBTP1oGCAEMB8B4JwALP2PxF8Isff/+mbSBMDmm5Oij4UKMoA+AackgBwCkADgzwBUL4CIJfxObMAfiZpL7kdOwFKSBDwDUF7AIQCszAKAmAfhZ+KuHACAoelqolECGNx2KwSsHELANyUBzF8AUL0BWIb64j++vgB9Kv6SAFojF/RDkXdfJvwb2d+kFIkKAR5CADAA/ABw3gMq9n4+nz1IdH8HnQOQPxV7d3cvu5/ZHgXxVIC7GKA4gRoDAJcAkGsGgML8g/cziabiAz7s/Od+LPoGgKOzpPdzpCCKNENAjhYCGGIAWGv4f3B/77FMM+gQ8OkW9XPxhRQ3dKCgYECDgDViCGC/X9S8LOfSW7H4XwE5rgAIVgCj+cH9qVIPd3eAB4ZwPhVtcWCI7NCYu3uNm9ozwEPg8iEpfhDgLwuLeDh4WVXFdCby3w2ARgHI97+0X8d8WQiYTJhl5uZe7dbwyBhhAribat7XjIvAmQDBgqAjAFtNAEz8F7wGLgwAiYn9shBgQ0AxBZy4EyDz/177zg4IJMIQoPXhAAUBNgB8MwTgRfoMoF0BRDMT+yVVwL4QNBu3wsQ9Magqb69lBxAa3VqJgGhzCEgI+CbOAQylBFAHgHL4T430ID3rUfOwv9K2T9KzQyflIZQ6F/t0JfH/3uzmZtMiCKRaIQC6CIAGgBMA0tYmkLQI/zND/yUhoHStGNafrpQqD31lquODD8fQqq5zKzt/9N705qZFPIxWrc0hqcFjQQQAADIANwCkZfifGmumOPCX3SpVHvusdXa04mJMQdGDxd09PETSEOCYAzwD0AoAi+q3nx9s/C+6SOWbWgZnyDtc5t7q9mYP84T35Qj+eiA+AFAZoBkACv+nNh0kTwLavgL+LVD/94TXCZDPBA1zgCkAhiWAfglo7z8MAR40tVVBwAKiDFQXAXYAOGQAEP8L9cH/h5kLAbmsDLTNAd4AUGaAxK7+05kLDsD/koDLbBAwB6ADoB0Aivm/S/+oC8HOde92f9MGAXYhwB0Aw3VAMQD1ALB09D98Au6d728uKwOti4CGfTwAAGpAVQYoCgDH/gmdgHuA+5unzjnAoApk+uuAxiVAcxFgEc2mzh0UNAHu/u/LgFVrKQC8CNiqAYDPAOn8AaCDAiYA6PbmODlAAYC5Xmo6fw3k+blyFFC1AEgjkA4qu+h+uP5XQ0CtDiwZeH6uHzl/lr2LDMj/OgBZBQCwGUDgK0L3U6C7KybKlfXACwCZBICXUABYNwG4BIBVBOZ/iGngHvLmoufqDuE6AOvAAXg+AtDKAMkcEIBitAUVBO5B760SAuo54PkSAgIGgF8CpJABILRK4B761s4hQFgEhAaAsgTI5sAATGehVAL3M+g7q64G6RUBgQDQKAGqGQBkDaCNwP1wir96CMgqIUCjCPAPgEYNuAReBOTvorjvOPej3NbD+ej5Uw7AqgKZpxownaMAUCIw7SoM3D9MZ0g3VV8MwqwCmacaMJ4hAXB4zerh/n7i13w89+s5ALsKxAYAaw7Ag6CgwI80XmYEnAf0AgDBJAC7BOC8celDHu7ksj2wvRQEOg3ABMBHCTBQVdaC2tOAcAG4TAJaJQABYIpAtORXgcDzQF8AzAgA610BfQJAMAtMI/LfGIDcaB7oG4AXAiAsAGwJYC+t6wiv9cJXLjwZxvMkYFgA1LYGCs6SyQWWCA1sm2gCwO9aAGQcAJ4JAHMAlhwAMi0Afu8EgLUEAIoAbgsBLQDWnQDwQgD0A4CXrgFICQAMANJ+AZAQAHAAJAQAAUAAEAAEAAEQPAAZ70kAAeAAQG0tMCMACIDepAACAB6AXq0DEABgACwJAAKgRwBkBAAGAJ0vBZs/DIrpaaA9AMvq22E9eBiUEwD+AEDcD2ConDP+Ww8DKQW4zwJOBDRjQO5oIAFAAIADkNI6AM46QNqjCEAAIK0EBgzAug0A4J5Av69mdd7G2p7AFgDrcAG4PAtYagJQ9JX0gI2H6fHVz8rBq+FRcDkP9NLGY+Mldya+iwYAy2UzA4QCgLAI0ASg7DXVS53H93FPxy/PLifNhuP+sUnVNhbNVtzX/t4tAQDyHxUAjW3hRRf88lmtKIrz1/ePvTavu/K84fmhx0Nwf1qe/znft3FzamNetFHjxn6ZCjumvS18gADMNOyP4tdDp160/9/DscPTjhnYR7B5FL832vhxbKMaAVHP9B2AWhWY8wFQ+x9ldevrFOyi+bTLMHA8+zeRtTFTMvAgB2CBOgsEBUA8Dci4ACj9jzeinj138OEA4q6mag+zKP6Qt7H441hFALdv5isfkwB4ALhVIBcAlf+Zwv1j/74WCEw7QKBI/bNIs43PkWkWqL4cijkJcAdAqwhIowce5M72H/r3NfKfB4roP42021ggILtXbgQ4fSQItwTwBADvAxHSABBr27/v38R3Htgf92zSRmki4ISAxmfC+gZAey1wzgFA3CMbE/v33Rt5/QRJedLvh3kb9auA2XR2PFF+gboQDAyAuAhY8b4RJB7+G2N9rObe0kB5yKtVG4VB4P6hXQN6WQeEBECaA3jzwJmgN14t+rbo3U3kqRYs/I82lm3UzQEFAFoZAACAr0flutfMuVpfzovlvRqU6gPwYdW3ZfdGXgqB8phv2yZuBGmAA0Dtg/H11wIaDNSkbd7Jd3gAuO+Hc4sA7sqPdd+WIdZDIbBP/w5tjDSrwEj8djgOAF9xAWgXAdwi0KVvvRBQfsHRsY0a88Dm8ZHwAHxFAGDNA0D8eihvGujmvwcCnP3nE8DJAHltN0ADgDUGAF916wrtIkCeAzgAuPqPTgCA/zwCtDOAawnw0vIfAwB+DsgjZQ5w97/sXcTZYFn/Q7SxWQdI94RDZgA9AGCLgMXl4PipogwE6Nv9XAAPABD/WwTw5gArWQYALAFAAZDnAF4ZWEsCGxjhEQDlf9FG1SIAvwREKAHgAFDmgCSaTmUEvHxAEYD0ZfLClw2YZAVA4+BIgwAABABUDqivBfGWg4ui6hfNAuCjItWqMEohqFEAGrQxvqwCq+aAl90g8KsAwADIcwAnBOwfqv+iLgCK/vz7r9HtXtGvf1fsE8FJAqoEYNrG/ej/5YH7IHCFnAFUAOSAOUD1eshxP+1OuoT+WHTq1VnF/zxKF+MxkkAxLj+A2zjlbmutfCb6GACgMkAOBYBWDuAtBfDPDZnJZ1cff0Vlx17fnnVddnD0l+SfxBg1QAzdRu7G9vJB8EIaAAAyABoAiucBS/4DO1l19bEpu/b29ubm+qybm3Ks3UoeycEnARmjoG2sVoDCEjBMADRCQC7YHCrs3I/Hfddet7Tv3kdh7+6A68DicivgNvJr1WoCMA0A/gCwLQP5Z8hLsutHVHThzTVXN0X3isGJoAGIvLSxOgOALgGVAHx1BUCnCuDuDRP00cfmljuyKiPsVhRiwUNABt7Gj2zGe9a8xAoA3EmAAAALle26+F8AkB6+E9EAYNnavCesAPZ9ey2VpHdBQ4CcUbA2FpPi81PAMwD7L0OkFwBW+45eO5mFBEDF/9VpKegwEawQkDYJEEdXZd8eelf4UAgSgNhDG0v/s6r/l0lgFYB9EggPgAYBWZ2AWEhA8T9bfvdo9O2+dz/Q1wKEVQpoG0v/V40K4OJ/Bui/DwDEIaBBgKhzi9pKo2/L3o0+sHOAKEiBtrHca1j3Hy0A4ACQNwEQhYA4iSrkCzr341Gvb8ve5c60Pl4Ay8BZgtPGZFar/9JYIwCs3P0XAeArBMRJfH6dT5gBbvU79xY5BwgzAFwby1cNzpuAfAYASADkIaBGQLw4vc4n6Fzd4CoJsHA5QBSk4Nq4f9MslviPFgDAAWiHgP1D4UYSKAuB+R4BQef+dXt1o9u5N1e3f6HOAwRzALA2FtXfvDL9vySA44Ng6AAgBgA6B0hCQKGofL+e37kmg0tcYwHlgCJIvW+Q2vhetvFhGsWJSQAAzAANAITSu+a6sRh8AmDZjgD7SqBEgNu5+tlVkmE/4AD4QGxj+YWZpNU5l0Wg6luhR/9NPFEJDYDKW8L13aFxdVkwmvI6V7+8lhXZUEUAP0uBtZFn/2kv6LLpf2cAIBFQlAKR9fqKaqUFGQCYNsY8+z367wUAYRIo9cqPrjcmnXvDja/7VwQgxK8BQdq42XA7RZQAAgbANgTwAPj449aob8vHrn98cJ8IgmiWf6C1cRMjBQBoAHSBk9aBPALeOAD8ahZdy/j6K6dz3yMgbfDauFH4L6oAoQIAHAC2ScB5giWZZGECANVGpAQAD4B1CDglAQEBADWguAoE0gdeGzepyP9LAsAMAO4AVP7Gvn2l+a19QWcAFj4BQI0AUG1MRAmg8XHQY7euv1Yo0LMFCoCvyh9aN5YCa6uBx+XABQEgB2BxWgTkrAKeosDayBZ/AHAIaJWBLQLGDkDa9r9RAsj97xoAjRBQfyJAACgBqD0FsAoAOABYhYBzEhARQACI/ddIAK4BwB0ATggwImDs08CFsf+gAcAIAOsQICsE3xEXWfq2ENQuANEDAAAAjgS84y0FgwGA2UYE//EAcE8C7anADu1h0GYHBcAWr43vwgmAlwQADwAvBEgJyPEeB6dQAKRobdy8avuPEwAMAXBNApdC8ExA5rTfWrrZIoYCIEbbELLZNvyvFoAeEgAeAPoEuG24lm26jiLEKhCojSsz/zsHAIEAtA2XyADAtLFr/4EA0CoDBARwq0CALdebVzgAXrHa+K7pv34CwAbANgTwJoMLYRUI8tLFAg6ABdKLIZtdw/+l1H+EAGAOgAsBKZeAjVuGFb59HUXIRQBAG1c8/1OP/oMBYBIDGlngfYPx4iXchjDBUhBEGzcm8R8jARQArMUyvdb6a+UfV/eFrLLC/dNHQ/abQ6pLgvkG5dXrBBKABOX18EMGuIz/4y6gNDv016q2E6Tii7kzYskAMEVgXfe/MfjP418zBzh+fGETQwKA1EZ+BjhuBOOHAUdfUAGwI2ARi74S6vL5Fcg5gHAe4NrGdy/+uwDg8FMr/RiQInwkCjYAiEOAUxu3Bf2a/q+Q/FcBAJYExAQsBGWg22fiNhGwMNp4HP6G/kMmAGgATAk4BoF8A/0Rxk0CDUAC/qHIogQ82Y/ovysAmARc0sD7BvhTseABQBgCHNq4qE4AOvIfHAArAkRVgPWHmKErAEkVYN/GrQ//3QHwQ8DrBvJT7Ju3CEFvsG18D8J/ZAC0CUg2kIcxYAQAWQiwauMqTsz97wIAyBDQIOBcCibxywbuOJZNHqEoh2zja9ws/wT+4wYADAB0CGgGgURcBxofyIRRASrqQIs2Jif7G8Mf1H8YAHwQkMiTgJliLABiuDZmcRj+awHghYB4BdW3iwiJgBiOgG28DMN/JACkBHAKgaI3lvEWqG+j/UcI4e0vrwrUxte4br8o/a/gXHACYH182gtMQNYgYAfSt9H5Q5TA7u+vCdLG91hv+Fv7v9b23wQAuNkgj4ACAdlqgH7fNr9HCmS95E0mYy0Xl6f/muHf2QIhAE9yHTckHPYhGKj4y6uz8YIYkLbqgFdw/21JEF/HnYBkkdQBSAXj/wzCyrz3y3+0/9cKg1UAPPFo1NRKLF4VAECAxH9NEDQu8A7gP68CkHSXQ+8/dQiAjIBVjYDLbPDVrbbyIqc64D1ZLOv2pyr7nTrfGQCPBJQIuMwFdnEcPAGvcSP+d+y/BgC4BLSCQJzb9u0q9qbMfv6f8IZ/d/4bAABPAD8ILFK7JBt71bslo8bD363bQQBwCgEaBDSDwGKxCzj8O6SB1zL9Gw5/t15/AgXAAwHHKBBnpgMsib1rYdrGPG6MfnT/oQDAJIAXBJbLxeLFrGs7kdHTi20x/Jemwx/ffz0ATnqG0PlqWdZYEDz7XwaBZKtfWHUm7Tbulsfhz4kApZC6GBoA6OZJCCgReHkPd/Sfv3Cj0cb3bXKxn+f/U3f+GwIA00C9IFAgEGc75cDqXKmija/5Qm5/htW7GACAt1FGwDIpuu55Jxhj77ssDkSpsI2vzwXGF/s9DH9D/40BwCOAi0AZBuI0373Wevj9fbdK4rC0arbxdZeni5r78uHfjf9dAaCPQFLGgfKUwWV6eAM+FZw+FYIWxzZme3DjRbJM/NrvAQBPBFRKgXLxNEnCdZ2Pwr7RCS/5B+W/BQBgbdVG4PCoeLHgnjcQmvH7txwOO765ox/VfnP/bQDAJUAYBZI++H953V85+sPw3woAJywqy1wN59sApPUIsOhLBFjUI0DKB6DCQaVT8KzGBsCSAA4CHAaSpApB4O4n1QAgdz976th/SAC0I5kyCNQISFtZIEwGFrXBz7Ff5L+5/YD+gwJgTkC7ApAgEDIDXPe17K8S0IH/sADYxgAeAXUEgmZAw32e/bbhH9R/YAD069kGAaYIBANBw3xT+5/M7Yf1HxoAGwK0o0BwDOi5rzX6u/IfHACDOa0DAm0GFp2Z33Qf135o/+EBsCRANB9QM9ABBG3zTdxv1f5d+o8AgMm6Vmm8OQKSOIBOQe2nFO7r2P9kZD+8/xgAmCKgrgYlDFwCQYJNAc96/nqvxP1W7det/UgAWBIgKQU4CDQfFrVjwQJl2PPMb7kvtd8y+qP4jwSA0eONVhAQIdBmgBcImhQ4gNC6UPVXxOaL3G8t/BjZj+M/FgBmD7hcEKhtH5JioIsC9x8mXO957iPZj+Q/GgDWBKgQ4DFQhWCphMBYAu955gvd59gfhP94AJg+5G4jIGaAC0GNgnowsGGhdYGlynux+dmT4+jH8x8RAFME9s7rEqCBQJsBXQo4/3DpYn/D/6cnY/8RTWKPAAJrjbbVItNF1rtGfh4GEhh0ngIACMI7EADgCHgyGO8KCvgx4PRtYo7fgsEvMF7tfSoPB2H4DwTAI2RQskJACIGQAx2Jr6luD7L7QP5DAYBPgA4DEggMWFBeJLV0P0T/wQDwgoAOAxoUOEirAVl/7IcE4BG2OnVBAAMD7R/24D6g/5AAABNgthSEx4HJr2WZF/sB/QcFAJoA05UgWBCMfyLzZT+k/7AAgBMAFAY0cXC6pDf3Yf0HBsArAq4UgCnLsr7aDw8AAgFyBrJwzc8w+uIxdABQCFAwkAVofobTD4/hA4BEgAKBLCz3keyH9x8DADQEVAz4okDZjKfe2I8EABoBGgzgUqDx83j3/tgfABAJ0IMAGgTNn0S97cc+ARAGAiAU6P9WD+0vAPgNS9Kfzfwq3ZOgTcP+L2ep50ZKOwzNJjwA5AT4RqBGQ3qEIjuP8bTyB93osRv/MQEIF4Hw1JX9yAAQAqHbjw6AggBCQGk/sv/oABACQdvvAwAVAY9kf4f++wCAgkCww98XAOooYK6+jWVz+XHGEwC/4SxjDdV7f/57AwALgcdhuv/ozRZ/AKAh0B0EaDfk0RSfACAi4J0CzDvxaolfAFAJ8EUB9j38NmQA8BHAxMBH23374R0APwgAc+Ctyf7d6AAAjwi4guC5oV14wf7Vl34LRPK9IKG00pst/gAIB4Hw5dEUnwAQAsHZ7xsAQiAw+/0DQAgEZX8XABACAdnfDQCEQDD2dwUAIRCI/d0BQAgEYX+XABACAdjfLQCEQOf2dw0AMfBb1/3fOQDjRqD73g8AgPEiEELfBwHAKBkIpONDAWBsCATT7eEAMCIGQupz9i+Byzdk0L8Xev8GDwAGBL7Uh77tBQD9RKAfPdsTAHpGQY86tU8A9AOCnnVo3wAIG4IedmYfAQgTgp52ZF8BCAuCHndinwEIgoK+91/vAeiQgkF03TAA8I3BgDptSADggzDAzhoiAAgcDLeXBgyAOwpj6JtRAKCHxDh7YqQAkAgA0gGAfyaNWgQAAUAiAEgEAIkAIBEAJAKANC4AfiWNWgQAAUAiAEgEAIkAIBEAJAKARACQRgTAP5FGLQKAACARACQCgEQAkAgAEgFAIgBIBACJACARACQCgEQAkAgAEgFAIgBIw9P/A9cxh+yn6cq5AAAAAElFTkSuQmCC', 'base64');

/* ---------- хранилище ----------
   Если заданы UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN — данные хранятся в Upstash Redis
   (переживают перезапуск и сон сервера). Иначе — в файле data.json (на бесплатном Render он стирается). */
// чистим ключи от кавычек, пробелов и посторонних (не ASCII) символов, которые могли попасть при копировании
const clean = v => String(v || '').replace(/[^\x21-\x7E]/g, '').replace(/^["']+|["']+$/g, '');
const REDIS_URL = clean(process.env.UPSTASH_REDIS_REST_URL), REDIS_TOKEN = clean(process.env.UPSTASH_REDIS_REST_TOKEN);
let useRedis = !!(REDIS_URL && REDIS_TOKEN), redisError = '';
let db = { users: {}, sessions: {}, meta: {}, promos: {} };
let urgent = false, lastFlush = Date.now(), flushing = false;
const persisted = { u: {}, s: {}, p: {}, m: '' };
const save = (now) => { if (now) urgent = true; dirty = true; };
let dirty = false;

async function redis(cmds) {
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('Redis HTTP ' + r.status);
  const out = await r.json();
  const bad = out.find(x => x && x.error);
  if (bad) throw new Error('Redis: ' + bad.error);
  return out;
}
const pairs = flat => { const o = {}; for (let i = 0; i + 1 < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1]; return o; };

async function load() {
  if (useRedis) {
    try {
      const [u, s, pr, mt] = await redis([['HGETALL', 'cm:users'], ['HGETALL', 'cm:sessions'], ['HGETALL', 'cm:promos'], ['HGET', 'cm:meta', 'main']]);
      const U = pairs(u.result), S = pairs(s.result), P = pairs(pr.result);
      for (const c in P) { try { db.promos[c] = JSON.parse(P[c]); persisted.p[c] = P[c]; } catch (e) {} }
      if (mt.result) { try { db.meta = JSON.parse(mt.result); persisted.m = mt.result; } catch (e) {} }
      for (const k in U) { try { db.users[k] = JSON.parse(U[k]); persisted.u[k] = U[k]; } catch (e) {} }
      for (const t in S) { try { db.sessions[t] = JSON.parse(S[t]); persisted.s[t] = S[t]; } catch (e) {} }
      console.log('Хранилище: Upstash Redis, игроков: ' + Object.keys(db.users).length);
    } catch (e) {
      redisError = e.message; useRedis = false;
      console.error('Redis недоступен (' + e.message + '). Работаю с файлом, данные могут пропасть при перезапуске!');
      try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e2) {}
      db.users = db.users || {}; db.sessions = db.sessions || {};
    }
  } else {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
    db.users = db.users || {}; db.sessions = db.sessions || {};
    console.log('Хранилище: файл data.json (на бесплатном Render данные могут пропадать!)');
  }
  db.meta = db.meta || {}; db.promos = db.promos || {};
  for (const t in db.sessions) if (Date.now() - db.sessions[t].t > SESSION_TTL) delete db.sessions[t];
  if (!db.meta.week) db.meta.week = weekId();
  for (const u of Object.values(db.users)) normUser(u);
  rollWeek();
}

async function flush() {
  if (flushing) return; flushing = true;
  try {
    if (useRedis) {
      const cmds = [], apply = [];
      for (const k in db.users) { const j = JSON.stringify(db.users[k]); if (persisted.u[k] !== j) { cmds.push(['HSET', 'cm:users', k, j]); apply.push(() => persisted.u[k] = j); } }
      for (const t in db.sessions) { const j = JSON.stringify(db.sessions[t]); if (persisted.s[t] !== j) { cmds.push(['HSET', 'cm:sessions', t, j]); apply.push(() => persisted.s[t] = j); } }
      for (const c in db.promos) { const j = JSON.stringify(db.promos[c]); if (persisted.p[c] !== j) { cmds.push(['HSET', 'cm:promos', c, j]); apply.push(() => persisted.p[c] = j); } }
      for (const c in persisted.p) if (!db.promos[c]) { cmds.push(['HDEL', 'cm:promos', c]); apply.push(() => delete persisted.p[c]); }
      { const j = JSON.stringify(db.meta); if (persisted.m !== j) { cmds.push(['HSET', 'cm:meta', 'main', j]); apply.push(() => persisted.m = j); } }
      for (const t in persisted.s) if (!db.sessions[t]) { cmds.push(['HDEL', 'cm:sessions', t]); apply.push(() => delete persisted.s[t]); }
      if (cmds.length) { await redis(cmds); apply.forEach(f => f()); }
    } else if (dirty) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE);
    }
    dirty = false; urgent = false; lastFlush = Date.now();
  } catch (e) { console.error('Ошибка сохранения:', e.message); }
  flushing = false;
}
// Redis: раз в 30 сек (или сразу при регистрации/входе); файл: раз в 2 сек
setInterval(() => { if (dirty && (!useRedis || urgent || Date.now() - lastFlush > 30000)) flush(); }, 2000);
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, async () => {
  setTimeout(() => process.exit(0), 8000).unref();
  dirty = true; await flush(); process.exit(0);
}));

/* ---------- утилиты ---------- */
const err = (m, s) => Object.assign(new Error(m), { status: s });
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
const rid = () => crypto.randomBytes(5).toString('hex');

const hits = new Map(); // простой лимит попыток входа: 10 в минуту с IP
function limited(ip) {
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  return h.n > 10;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 60000) hits.delete(k); }, 60000);

/* ---------- состояние игрока ---------- */
const newState = () => {
  const g = Array(GARAGE).fill(0); g[0] = 1;
  return { money: 100, coins: 0, garage: g, bought: 0, upg: { inc: 0, spawn: 0, cheap: 0 }, perm: { mult: 0, auto: 0 }, shop: { boost: 0, car: 0 }, boostUntil: 0, maxLevel: 1, applied: [],
    stats: { merges: 0, buys: 0, upgs: 0, top: 0 }, quests: { day: '', p: { merge: 0, buy: 0, upg: 0 }, c: {} }, ach: {} };
};
const num = (v, max = BIG) => { v = +v; return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0; };
const int = (v, max) => Math.floor(num(v, max));
function cleanState(s, old, dt = 4) {
  if (!s || typeof s !== 'object') return old;
  const garage = (Array.isArray(s.garage) ? s.garage : old.garage).slice(0, GARAGE).map(x => int(x, MAX));
  while (garage.length < GARAGE) garage.push(0);
  const u = s.upg || {}, p = s.perm || {};
  const st = s.stats || {}, os = old.stats || { merges: 0, buys: 0, upgs: 0, top: 0 };
  const allow = Math.floor(15 * Math.min(3600, Math.max(dt, 1))) + 50;   // не больше ~15 слияний в секунду
  const stats = { merges: Math.min(Math.max(os.merges, int(st.merges, 1e9)), os.merges + allow), buys: Math.max(os.buys, int(st.buys, 1e9)), upgs: Math.max(os.upgs, int(st.upgs, 1e9)), top: Math.max(os.top || 0, num(st.top)) };
  const q = s.quests || {}, qp = q.p || {};
  const quests = { day: /^\d{4}-\d{2}-\d{2}$/.test(q.day) ? q.day : '', p: { merge: int(qp.merge, 1e6), buy: int(qp.buy, 1e6), upg: int(qp.upg, 1e6) }, c: {} };
  for (const id of Q_IDS) if (q.c && q.c[id]) quests.c[id] = true;
  const ach = {}; for (const id of A_IDS) if (s.ach && s.ach[id]) ach[id] = true;
  return {
    stats, quests, ach,
    money: num(s.money), coins: num(s.coins), garage, bought: int(s.bought, 1e6),
    upg: { inc: int(u.inc, 100), spawn: int(u.spawn, 5), cheap: int(u.cheap, 10) },
    perm: { mult: int(p.mult, 1000), auto: int(p.auto, 1) },
    shop: { boost: int((s.shop || {}).boost, 1000), car: int((s.shop || {}).car, 1000) },
    boostUntil: num(s.boostUntil, 8e15),
    maxLevel: Math.max(1, int(s.maxLevel, MAX), ...garage),
    applied: (Array.isArray(s.applied) ? s.applied : []).map(String).slice(-200)
  };
}
function normUser(u) {
  u.state = u.state || newState(); const s = u.state;
  s.stats = s.stats || { merges: 0, buys: 0, upgs: 0, top: 0 };
  s.quests = s.quests || { day: '', p: { merge: 0, buy: 0, upg: 0 }, c: {} };
  s.ach = s.ach || {}; s.shop = s.shop || { boost: 0, car: 0 };
  u.grants = u.grants || []; u.badges = u.badges || []; u.daily = u.daily || { last: '', streak: 0 };
  if (!u.week) u.week = { id: db.meta.week || weekId(), base: s.stats.merges };
}
// подведение итогов недели: награды топ-3 и сброс недельного счёта
function rollWeek() {
  const cur = weekId(); if (db.meta.week === cur) return;
  const prev = db.meta.week, medals = ['🥇', '🥈', '🥉'];
  const rows = Object.values(db.users).map(u => ({ u, score: Math.max(0, u.state.stats.merges - (u.week && u.week.id === prev ? u.week.base : u.state.stats.merges)) }))
    .filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  rows.forEach((r, i) => { r.u.grants.push({ id: rid(), type: 'coins', amount: WEEK_PRIZES[i], note: 'Награда недели ' + medals[i] }); r.u.badges = [...r.u.badges, medals[i]].slice(-5); });
  if (prev) db.meta.winners = [{ week: prev, list: rows.map((r, i) => ({ nick: r.u.nick, score: r.score, prize: WEEK_PRIZES[i] })) }, ...(db.meta.winners || [])].slice(0, 8);
  db.meta.week = cur;
  for (const u of Object.values(db.users)) u.week = { id: cur, base: u.state.stats.merges };
  save(true);
}
const weekScore = u => Math.max(0, u.state.stats.merges - (u.week ? u.week.base : 0));
const income = s => {
  const m = (1 + .15 * s.upg.inc) * (1 + .25 * s.perm.mult) * (s.boostUntil > Date.now() ? 2 : 1);
  return s.garage.reduce((a, l) => a + (l ? INCOME_MULT * Math.pow(2.3, l - 1) : 0), 0) * m;
};

const promoHits = new Map();
function promoLimited(ip) {
  const now = Date.now(), h = promoHits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000) { h.n = 0; h.t = now; }
  h.n++; promoHits.set(ip, h); return h.n > 10;
}
function dailyInfo(u) {
  const today = dayStr(), yest = dayStr(Date.now() - 864e5), d = u.daily || { last: '', streak: 0 };
  const can = d.last !== today;
  const streak = d.last === today || d.last === yest ? d.streak : 0;
  const day = can ? streak + 1 : streak;                       // номер дня серии
  const idx = Math.max(0, day - 1) % 7;
  const money = Math.max(500, Math.floor(income(u.state) * 120 * (idx + 1)));
  const n = new Date(), tomorrow = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
  return { can, streak, day, cycleDay: idx + 1, coins: DAILY_COINS[idx], money, rewards: DAILY_COINS, left: Math.max(0, Math.floor((tomorrow - Date.now()) / 1000)) };
}

/* ---------- авторизация ---------- */
function session(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ss = t && db.sessions[t];
  if (!ss || Date.now() - ss.t > SESSION_TTL || !db.users[ss.k]) return null;
  return { token: t, k: ss.k, u: db.users[ss.k] };
}
const need = req => { const s = session(req); if (!s) throw err('Требуется вход', 401); return s; };
const admin = req => { const s = need(req); if (!s.u.isAdmin) throw err('Нет доступа', 403); return s; };
const profile = (k, extra) => Object.assign({ nick: db.users[k].nick, isAdmin: !!db.users[k].isAdmin, state: db.users[k].state, grants: db.users[k].grants }, extra);
function login(k) {
  const token = newToken();
  db.sessions[token] = { k, t: Date.now() }; save(true);
  return profile(k, { token });
}

/* ---------- рейтинг ---------- */
const SORTS = ['maxLevel', 'money', 'coins', 'week'];
function board(sort, me) {
  const rows = Object.values(db.users).map(u => ({ nick: u.nick, maxLevel: u.state.maxLevel, money: Math.floor(u.state.money), coins: Math.round(u.state.coins * 10) / 10, income: Math.floor(income(u.state)), week: weekScore(u), badge: (u.badges || []).slice(-1)[0] || '' }));
  rows.sort((a, b) => b[sort] - a[sort] || b.maxLevel - a.maxLevel || b.income - a.income || a.nick.localeCompare(b.nick));
  rows.forEach((r, i) => r.rank = i + 1);
  return { sort, total: rows.length, weekLeft: Math.max(0, Math.floor((weekStart() + 7 * 864e5 - Date.now()) / 1000)), winners: (db.meta.winners || [])[0] || null, players: rows.slice(0, 50), me: me ? rows.find(r => r.nick === me.u.nick) || null : null };
}

/* ---------- маршруты ---------- */
function route(req, p, q, b, ip) {
  const M = req.method;
  rollWeek();
  if (p === '/api/health') return { ok: true, storage: useRedis ? 'redis' : 'file', ...(redisError ? { redisError } : {}) };

  if (p === '/api/register' && M === 'POST') {
    if (limited(ip)) throw err('Слишком много попыток, подождите минуту', 429);
    const nick = String(b.nick || '').trim(), k = nick.toLowerCase();
    if (!/^[A-Za-z0-9_\-а-яА-ЯёЁ]{3,16}$/.test(nick)) throw err('Ник: 3–16 символов (буквы, цифры, _ и -)', 400);
    if (String(b.password || '').length < 4) throw err('Пароль: минимум 4 символа', 400);
    if (db.users[k]) throw err('Этот ник уже занят', 409);
    const salt = crypto.randomBytes(16).toString('hex');
    db.users[k] = { nick, salt, pw: hashPw(String(b.password), salt), isAdmin: !Object.keys(db.users).length, grants: [], state: newState() };
    normUser(db.users[k]);
    return login(k);
  }
  if (p === '/api/login' && M === 'POST') {
    if (limited(ip)) throw err('Слишком много попыток, подождите минуту', 429);
    const k = String(b.nick || '').trim().toLowerCase(), u = db.users[k];
    const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(b.password || ''), u.salt), 'hex'), Buffer.from(u.pw, 'hex'));
    if (!ok) throw err('Неверный ник или пароль', 401);
    return login(k);
  }
  if (p === '/api/me') { const s = need(req); return profile(s.k); }
  if (p === '/api/logout') { const s = session(req); if (s) { delete db.sessions[s.token]; save(); } return { ok: true }; }
  if (p === '/api/sync' && M === 'POST') {
    const s = need(req);
    const now = Date.now(), dt = (now - (s.u.lastSync || now - 4000)) / 1000; s.u.lastSync = now;
    if (b.state) s.u.state = cleanState(b.state, s.u.state, dt);
    const ack = new Set(b.ack || []);
    s.u.grants = s.u.grants.filter(g => !ack.has(g.id));
    save(); return { ok: true, grants: s.u.grants };
  }
  if (p === '/api/leaderboard') {
    const sort = SORTS.includes(q.get('sort')) ? q.get('sort') : 'maxLevel';
    return board(sort, session(req));
  }
  /* --- ежедневная награда --- */
  if (p === '/api/daily') { const s = need(req); return dailyInfo(s.u); }
  if (p === '/api/daily/claim' && M === 'POST') {
    const s = need(req), u = s.u, info = dailyInfo(u);
    if (!info.can) throw err('Награда за сегодня уже получена', 409);
    u.daily = { last: dayStr(), streak: info.day };
    u.grants.push({ id: rid(), type: 'coins', amount: info.coins, note: 'Ежедневная награда' });
    u.grants.push({ id: rid(), type: 'money', amount: info.money, note: 'Ежедневная награда' });
    save(true); return { ok: true, grants: u.grants, ...dailyInfo(u) };
  }
  /* --- промокоды --- */
  if (p === '/api/promo/redeem' && M === 'POST') {
    const s = need(req), u = s.u;
    if (promoLimited(ip)) throw err('Слишком много попыток, подождите минуту', 429);
    const code = String(b.code || '').trim().toUpperCase(), pr = db.promos[code];
    if (!pr) throw err('Промокод не найден', 404);
    if (pr.exp && Date.now() > pr.exp) throw err('Срок действия промокода истёк', 410);
    if (pr.used >= pr.max) throw err('Промокод уже закончился', 410);
    if (pr.users[s.k]) throw err('Вы уже активировали этот промокод', 409);
    pr.used++; pr.users[s.k] = 1;
    if (pr.money) u.grants.push({ id: rid(), type: 'money', amount: pr.money, note: 'Промокод' });
    if (pr.coins) u.grants.push({ id: rid(), type: 'coins', amount: pr.coins, note: 'Промокод' });
    if (pr.car) u.grants.push({ id: rid(), type: 'car', level: pr.car, note: 'Промокод' });
    save(true); return { ok: true, grants: u.grants, reward: { money: pr.money, coins: pr.coins, car: pr.car } };
  }
  if (p === '/api/admin/promos') {
    admin(req);
    return { promos: Object.entries(db.promos).map(([code, x]) => ({ code, coins: x.coins, money: x.money, car: x.car, max: x.max, used: x.used, exp: x.exp, created: x.created })).sort((a, c) => c.created - a.created) };
  }
  if (p === '/api/admin/promo' && M === 'POST') {
    admin(req);
    let code = String(b.code || '').trim().toUpperCase();
    if (!code) code = crypto.randomBytes(4).toString('hex').toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw err('Код: 3–24 символа (латиница, цифры, _ и -)', 400);
    if (db.promos[code]) throw err('Такой промокод уже есть', 409);
    const coins = num(b.coins), money = num(b.money), car = int(b.car, MAX), max = Math.min(100000, Math.max(1, int(b.max, 100000) || 1)), days = Math.min(365, int(b.days, 365));
    if (!coins && !money && !car) throw err('Укажите награду', 400);
    db.promos[code] = { coins, money, car, max, used: 0, users: {}, created: Date.now(), exp: days ? Date.now() + days * 864e5 : 0 };
    save(true); return { ok: true, code };
  }
  if (p === '/api/admin/promo/delete' && M === 'POST') {
    admin(req); const code = String(b.code || '').trim().toUpperCase();
    if (!db.promos[code]) throw err('Не найден', 404);
    delete db.promos[code]; save(true); return { ok: true };
  }
  if (p === '/api/admin/players') {
    const s = admin(req), qq = (q.get('q') || '').toLowerCase(), all = Object.entries(db.users);
    return { total: all.length, players: all.filter(([n]) => n.includes(qq)).slice(0, 100).map(([n, u]) => ({ nick: u.nick, isAdmin: !!u.isAdmin, online: n === s.k, money: u.state.money, coins: u.state.coins, cars: u.state.garage.filter(Boolean).length })) };
  }
  if (p === '/api/admin/grant' && M === 'POST') {
    const s = admin(req), u = db.users[String(b.nick || '').trim().toLowerCase()];
    if (!u) throw err('Игрок не найден', 404);
    const money = num(b.money), coins = num(b.coins), car = int(b.car, MAX), cnt = Math.min(GARAGE, Math.max(1, int(b.count, GARAGE) || 1));
    let n = 0;
    if (money) { u.grants.push({ id: rid(), type: 'money', amount: money }); n++; }
    if (coins) { u.grants.push({ id: rid(), type: 'coins', amount: coins }); n++; }
    if (car) for (let i = 0; i < cnt; i++) { u.grants.push({ id: rid(), type: 'car', level: car }); n++; }
    if (!n) throw err('Нечего выдавать', 400);
    save(true); return { ok: true, nick: u.nick, online: u === s.u };
  }
  throw err('Неизвестный метод', 404);
}

/* ---------- HTTP ---------- */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const send = (res, code, obj, type = 'application/json; charset=utf-8') =>
  { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...CORS }); res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (!p.startsWith('/api/')) {
    if (p === '/' || p === '/index.html') {
      return fs.readFile(path.join(__dirname, 'index.html'), (e, d) => e ? send(res, 404, 'index.html не найден', 'text/plain; charset=utf-8') : send(res, 200, d, 'text/html; charset=utf-8'));
    }
    if (p === '/manifest.webmanifest') return send(res, 200, JSON.stringify({
      name: 'Car Merge Pro', short_name: 'Car Merge', description: 'Объединяй машины и попади в мировой рейтинг',
      start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait', lang: 'ru',
      background_color: '#07060f', theme_color: '#07060f',
      icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
    }), 'application/manifest+json; charset=utf-8');
    if (p === '/sw.js') return send(res, 200, "self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>new Response('Нет связи с сервером. Проверьте интернет и обновите страницу.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})))}});", 'text/javascript; charset=utf-8');
    if (p === '/icon-192.png' || p === '/apple-touch-icon.png') return send(res, 200, ICON192, 'image/png');
    if (p === '/icon-512.png') return send(res, 200, ICON512, 'image/png');
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let raw = '', big = false;
  req.on('data', c => { raw += c; if (raw.length > 300000) { big = true; req.destroy(); } });
  req.on('end', () => {
    if (big) return;
    try {
      let b = {}; if (raw) { try { b = JSON.parse(raw); } catch (e) { throw err('Некорректный JSON', 400); } }
      send(res, 200, route(req, p, url.searchParams, b, ip));
    } catch (e) {
      send(res, e.status || 500, { error: e.status ? e.message : 'Ошибка сервера' });
      if (!e.status) console.error(e);
    }
  });
});
load().then(() => server.listen(PORT, () => console.log('Car Merge Pro: http://localhost:' + PORT)))
  .catch(e => { console.error('Не удалось загрузить данные:', e.message); process.exit(1); });
