// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  factory = await hre.ethers.getContractFactory('contracts/Receiver2.sol:ProgrammableTokenTransfers')
  // 0xD84BAF72cF770Fb2707f12462B30feeca41Ee062
  sender = await factory.deploy('0xD0daae2231E9CB96b94C8512223533293C3693Bf', '0x779877A7B0D9E8603169DdbD7836e478b4624789')
  await sender.whitelistDestinationChain(12532609583862916517n)

  await hre.run('verify:verify', { address: signer.target, contract: `contracts/Receiver2.sol:ProgrammableTokenTransfers`, constructorArguments: ['0xD0daae2231E9CB96b94C8512223533293C3693Bf', '0x779877A7B0D9E8603169DdbD7836e478b4624789'] })

  link = await ethers.getContractAt('IERC20', '0x779877A7B0D9E8603169DdbD7836e478b4624789')
  ccip = await ethers.getContractAt('IERC20', '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05')
  await link.transfer(sender.target, 0.09e18.toString())
  await ccip.transfer(sender.target, 0.01e18.toString())

  await changeNetwork('mumbai')

  // 0xD84BAF72cF770Fb2707f12462B30feeca41Ee062
  receiver = await factory.deploy('0x70499c328e1E2a3c41108bd3730F6670a44595D1', '0x326C977E6efc84E512bB9C30f76E30c160eD06FB')
  await receiver.waitForDeployment(1)
  await receiver.whitelistSourceChain(16015286601757825753n)
  await receiver.whitelistSender(sender.target)


  await sender.sendMessagePayLINK(
    12532609583862916517n,
    sender.target,
'0x0000000000000000000000001cc86b9b67c93b8fa411554db761f68979e7995a000000000000000000000000f1e3a5842eeef51f2967b3f05d45dd4f4205ff4000000000000000000000000000000000000000000000000000000000000003e8',
    '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05',
    1000
  )

}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
