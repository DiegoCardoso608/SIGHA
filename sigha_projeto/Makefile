CC     = gcc
CFLAGS = -Wall -Wextra -std=c11 -O2

sigha_sim: sigha_sim.c
	$(CC) $(CFLAGS) -o sigha_sim sigha_sim.c

run: sigha_sim
	./sigha_sim

demo: sigha_sim
	./sigha_sim --demo --auto

clean:
	rm -f sigha_sim grade.csv
