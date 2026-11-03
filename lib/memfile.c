#define _GNU_SOURCE
#include <sys/mman.h>
#include <stdio.h>
#include <unistd.h>
/* Share an empty anonymous file with the parent. Only the parent holds it thereafter. */
int main(void) {
    int fd = memfd_create("agency-model", MFD_CLOEXEC);
    if (fd < 0) { perror("memfd_create"); return 1; }
    printf("%d\n", fd);
    fflush(stdout);
    getchar();
    close(fd);
    return 0;
}
