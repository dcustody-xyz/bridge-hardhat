// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  factory = await hre.ethers.getContractFactory('Sender')
  // 0xD84BAF72cF770Fb2707f12462B30feeca41Ee062
  sender = await factory.deploy('0xD0daae2231E9CB96b94C8512223533293C3693Bf', '0x779877A7B0D9E8603169DdbD7836e478b4624789')
  await sender.whitelistDestination(12532609583862916517n, "0x8F7a45eBDe059392E46A46DCc14AB24681A961Ea")

  await hre.run('verify:verify', { address: signer.target, contract: `ProgrammableTokenTransfers`, constructorArguments: ['0xD0daae2231E9CB96b94C8512223533293C3693Bf', '0x779877A7B0D9E8603169DdbD7836e478b4624789'] })

  link = await ethers.getContractAt('IERC20', '0x779877A7B0D9E8603169DdbD7836e478b4624789')
  ccip = await ethers.getContractAt('IERC20', '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05')
  await link.approve(sender.target, 9e18.toString())
  await ccip.approve(sender.target, 1e18.toString())

  await changeNetwork('mumbai')

  // 0xD84BAF72cF770Fb2707f12462B30feeca41Ee062
  receiver = await factory.deploy('0x70499c328e1E2a3c41108bd3730F6670a44595D1', '0x326C977E6efc84E512bB9C30f76E30c160eD06FB')
  await receiver.waitForDeployment(1)
  await receiver.whitelistSourceChain(16015286601757825753n)
  await receiver.whitelistSender(sender.target)

  // founder, DAI (aave)
  abiDecoder = new ethers.AbiCoder
  payload = abiDecoder.encode(['address', 'address', 'uint', 'bytes'], ['0x1cC86b9b67C93B8Fa411554DB761f68979E7995A', '0xc8c0Cf9436F4862a8F60Ce680Ca5a9f0f99b5ded', '1', paraswap])

  await sender.sendMessagePayLINK(
    12532609583862916517n,
    '0x8F7a45eBDe059392E46A46DCc14AB24681A961Ea',
    payload,
    '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05',
    1000
  )

}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
