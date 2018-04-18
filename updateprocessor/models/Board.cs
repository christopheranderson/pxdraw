using System;
using System.Drawing;

namespace pxdraw.updateprocessor.models
{
    class Board
    {
        private const byte leftmask =  0b00001111;
        private const byte rightmask = 0b11110000;
        private readonly int _boardSize;

        public Byte[] Bitmap { get; private set; }

        public Board(Byte[] board, int boardsize = 1000)
        {
            Bitmap = board;
            _boardSize = boardsize;
        }

        public void InsertPixel(Pixel pixel)
        {
            int offsetIndex = (pixel.X + pixel.Y * _boardSize) / 2;
            bool isLeft = ((pixel.X + pixel.Y * _boardSize) % 2 == 0);
            byte bitmask = isLeft ? leftmask : rightmask;
            byte color = (byte)(pixel.Color % 16);
            if (isLeft) color = (byte)(color << 4);

            byte b = Bitmap[offsetIndex];
            b = (byte)((b & bitmask) + color);
            Bitmap[offsetIndex] = b;
        }

        public override string ToString()
        {
            string board = "";
            for(var y = 0; y < _boardSize; y++)
            {
                for(var x = 0; x < _boardSize; x+=2)
                {
                    int offset = (x + y * _boardSize) / 2;
                    byte b = Bitmap[offset];
                    int left = (b & rightmask) >> 4;
                    int right = b & leftmask;
                    board += $"{left}, {right}, ";
                }
                board += System.Environment.NewLine;
            }
            return board;
        }

        public static Board GenerateBoard(bool random = false, int boardsize = 1000)
        {
            byte[] bitmap = new byte[(int)(Math.Pow(boardsize, 2) / 2)];
            Random rng = new Random();

            if(random)
            {
                for(var i = 0; i < bitmap.Length; i++)
                {
                    bitmap[i] = (byte)rng.Next(0b1111_1111);
                }
            }

            return new Board(bitmap, boardsize: boardsize);
        }

        public static Board GenerateBoardFromTshirt(int boardsize = 1000)
        {
            byte[] bits = new byte[(int)(Math.Pow(boardsize, 2) / 2)];
            Bitmap bitmap = new Bitmap("./content/tshirt.png");

            for(var i = 0; i < bits.Length; i++)
            {
                bits[i] = 0x33; //3 is white
            }

            Board board = new Board(bits);

            var xoffset = 250;
            var yoffset = 0;

            for(var y = 0; y < bitmap.Height; y++)
            {
                for(var x = 0; x < bitmap.Width; x++)
                {
                    Color pixel = bitmap.GetPixel(x, y);
                    if(pixel.G == 0 && pixel.B == 0) // RED
                    {
                        board.InsertPixel(new Pixel {
                            X = x + xoffset,
                            Y = y + yoffset,
                            Color = 5
                        });
                    }
                }
            }

            return board;

        }
    }
}
